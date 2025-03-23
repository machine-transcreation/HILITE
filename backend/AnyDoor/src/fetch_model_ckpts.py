import wget

url = "https://modelscope.cn/models/iic/AnyDoor/resolve/master/dinov2_vitg14_pretrain.pth"
relative_destination = "AnyDoor\model ckpts\dinov2_vitg14_pretrain.pth"

wget.download(url, out=relative_destination)

url = "https://modelscope.cn/models/iic/AnyDoor/resolve/master/epoch%3D1-step%3D8687.ckpt"
relative_destination = "AnyDoor\model ckpts\epoch=1-step=8687.ckpt"

wget.download(url, out=relative_destination)