import os
import yaml

def update_yaml_with_path(yaml_path, replacements):
    with open(yaml_path, 'r') as file:
        config = yaml.safe_load(file)

    def replace_paths(d):
        if isinstance(d, dict):
            for k, v in d.items():
                if isinstance(v, str) and v in replacements:
                    d[k] = replacements[v]
                else:
                    replace_paths(v)
        elif isinstance(d, list):
            for item in d:
                replace_paths(item)

    replace_paths(config)

    with open(yaml_path, 'w') as file:
        yaml.dump(config, file, default_flow_style=False, sort_keys=False, width=1000)

if __name__ == "__main__":
    repo_root = os.path.dirname(os.path.abspath(__file__))

    replacements = {
        'path/dinov2_vitg14_pretrain.pth': os.path.join(repo_root, 'model_ckpts', 'dinov2_vitg14_pretrain.pth'),
        'path/epoch=1-step=8687.ckpt': os.path.join(repo_root, 'model_ckpts', 'epoch=1-step=8687.ckpt')
    }

    yaml_files = [
        os.path.join(repo_root, 'configs', 'anydoor.yaml'),
        os.path.join(repo_root, 'configs', 'demo.yaml'),
        os.path.join(repo_root, 'configs', 'inference.yaml')
    ]

    for yaml_file in yaml_files:
        update_yaml_with_path(yaml_file, replacements)
