import os
import json
import math
import sys
from PIL import Image

# Prevent UnicodeEncodeError on Windows CP949 environment when printing emojis
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8')

def pack_assets(resource_pack_dir, output_dir, is_technical=False):
    # Configure input paths from the resource pack
    blockstates_in = os.path.join(resource_pack_dir, 'assets', 'minecraft', 'blockstates')
    models_in = os.path.join(resource_pack_dir, 'assets', 'minecraft', 'models')
    textures_in = os.path.join(resource_pack_dir, 'assets', 'minecraft', 'textures', 'block')
    entity_textures_in = os.path.join(resource_pack_dir, 'assets', 'minecraft', 'textures', 'entity')
    
    if not os.path.exists(resource_pack_dir):
        print(f"❌ Error: Resource pack directory does not exist: {resource_pack_dir}")
        return False

    os.makedirs(output_dir, exist_ok=True)

    # 1. Gather and compile blockstates from resource pack
    blockstates_data = {}
    if os.path.exists(blockstates_in):
        print("⏳ Collecting blockstates from resource pack...")
        for root, _, files in os.walk(blockstates_in):
            for file in files:
                if file.endswith('.json'):
                    name = os.path.splitext(file)[0]
                    full_path = os.path.join(root, file)
                    try:
                        with open(full_path, 'r', encoding='utf-8') as f:
                            blockstates_data[name] = json.load(f)
                    except Exception as e:
                        print(f"⚠️ Warning: Skip invalid blockstate {file}: {e}")
        
        # Save output blockstates.json
        blockstates_out = os.path.join(output_dir, 'blockstates.json')
        with open(blockstates_out, 'w', encoding='utf-8') as f:
            json.dump(blockstates_data, f, indent=2)
        print(f"✅ blockstates.json generated: {blockstates_out}")
    else:
        print("ℹ️ No blockstates folder found in resource pack.")

    # 2. Gather and compile models from resource pack
    models_data = {}
    if os.path.exists(models_in):
        print("⏳ Collecting models from resource pack...")
        for root, _, files in os.walk(models_in):
            for file in files:
                if file.endswith('.json'):
                    full_path = os.path.join(root, file)
                    # Keep relative path under models/ (e.g. block/stone or item/diamond_sword)
                    rel_path = os.path.relpath(full_path, models_in).replace('\\', '/')
                    name = os.path.splitext(rel_path)[0]
                    try:
                        with open(full_path, 'r', encoding='utf-8') as f:
                            models_data[name] = json.load(f)
                    except Exception as e:
                        print(f"⚠️ Warning: Skip invalid model {rel_path}: {e}")
        
        # Save output models.json
        models_out = os.path.join(output_dir, 'models.json')
        with open(models_out, 'w', encoding='utf-8') as f:
            json.dump(models_data, f, indent=2)
        print(f"✅ models.json generated: {models_out}")
    else:
        print("ℹ️ No models folder found in resource pack.")

    # 3. Gather and compile block & entity textures into Atlas
    texture_files = []
    max_tile_size = 16 # Detect maximum resolution dynamically

    # A. Block textures
    if os.path.exists(textures_in):
        print("⏳ Collecting block textures from resource pack...")
        for root, _, files in os.walk(textures_in):
            for file in files:
                if file.endswith('.png'):
                    full_path = os.path.join(root, file)
                    rel_path = os.path.relpath(full_path, textures_in).replace('\\', '/')
                    name = 'block/' + os.path.splitext(rel_path)[0]
                    texture_files.append((name, full_path))
    else:
        print("ℹ️ No textures/block folder found in the resource pack.")

    # B. All Entity textures (chests, beds, signs, banners, bells, shields, shulkers, pots, etc.)
    if os.path.exists(entity_textures_in):
        print("⏳ Collecting all entity textures from resource pack...")
        for root, _, files in os.walk(entity_textures_in):
            for file in files:
                if file.endswith('.png'):
                    full_path = os.path.join(root, file)
                    rel_path = os.path.relpath(full_path, entity_textures_in).replace('\\', '/')
                    name = 'entity/' + os.path.splitext(rel_path)[0]
                    texture_files.append((name, full_path))
    else:
        print("ℹ️ No textures/entity folder found in the resource pack.")

    num_textures = len(texture_files)
    if num_textures > 0:
        # Pre-scan dimensions for sorting & animation filtering
        texture_files_sorted = []
        for name, path in texture_files:
            try:
                with Image.open(path) as img:
                    w, h = img.size
                    # Handle vertical animations (crop to square)
                    if h > w:
                        texture_files_sorted.append((name, path, w, w, True))
                    else:
                        texture_files_sorted.append((name, path, w, h, False))
            except Exception as e:
                print(f"⚠️ Warning: Skip invalid texture size scan {name}: {e}")

        # Sort by height descending, then by width descending for efficient shelf packing
        texture_files_sorted.sort(key=lambda x: (x[3], x[2]), reverse=True)

        def upper_power_of_two(x):
            return 1 if x == 0 else 2**(x - 1).bit_length()

        # Dynamic Shelf Packing Algorithm
        max_width_val = max(x[2] for x in texture_files_sorted)
        atlas_width = max(2048, upper_power_of_two(max_width_val))
        
        packed_positions = [] # Elements: (name, path, x, y, w, h, is_cropped)
        
        current_x = 0
        current_y = 0
        current_shelf_height = 0
        
        for name, path, w, h, is_cropped in texture_files_sorted:
            # Start new shelf if width limit is exceeded
            if current_x + w > atlas_width:
                current_y += current_shelf_height
                current_x = 0
                current_shelf_height = 0
            
            packed_positions.append((name, path, current_x, current_y, w, h, is_cropped))
            
            current_x += w
            if h > current_shelf_height:
                current_shelf_height = h
                
        total_height = current_y + current_shelf_height
        
        final_width = atlas_width
        final_height = upper_power_of_two(total_height)
        
        print(f"📦 Shelf Packing: Packing {len(texture_files_sorted)} textures...")
        print(f"📦 Final atlas resolution: {final_width}x{final_height} (Actual required height: {total_height}px)")
        
        atlas_image = Image.new('RGBA', (final_width, final_height), (0, 0, 0, 0))
        textures_mapping = {}
        
        for name, path, x, y, w, h, is_cropped in packed_positions:
            try:
                with Image.open(path) as img:
                    if is_cropped:
                        # Height was greater than width (cropped animation frame)
                        cropped = img.crop((0, 0, w, w))
                        atlas_image.paste(cropped, (x, y))
                    else:
                        atlas_image.paste(img, (x, y))
                    textures_mapping[name] = [x, y, w, h]
            except Exception as e:
                print(f"⚠️ Error pasting texture {name}: {e}")
                
        png_filename = 'atlas.png'
        map_filename = 'atlas-map.json'
        
        # Save composite PNG
        atlas_out_path = os.path.join(output_dir, png_filename)
        atlas_image.save(atlas_out_path)
        print(f"✅ Composite image generated: {atlas_out_path}")
        
        # Save texture mapping coordinates to a dedicated JSON file
        map_out_path = os.path.join(output_dir, map_filename)
        with open(map_out_path, 'w', encoding='utf-8') as f:
            json.dump(textures_mapping, f, indent=2)
        print(f"✅ Texture mapping JSON generated: {map_out_path}")
    else:
        print("ℹ️ No textures found to compile.")

    print("\n🎉 Success! Custom pack compilation complete.")
    return True

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("💡 Usage: python pack_assets.py <path_to_minecraft_resources_folder> [--technical]")
        print("Example (Default Mode): python pack_assets.py D:/extracted_minecraft_jar")
        sys.exit(1)
        
    input_path = sys.argv[1]
    is_tech = "--technical" in sys.argv
    
    # Divide outputs under vanilla/ or tech/ based on --technical flag
    subfolder = 'tech' if is_tech else 'vanilla'
    output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'assets', subfolder)
    
    pack_assets(input_path, output_path, is_technical=is_tech)
