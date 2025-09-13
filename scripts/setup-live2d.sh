#!/bin/bash

# Live2D模型下载脚本
# 下载一个开源的Live2D示例模型用于测试

echo "正在创建Live2D模型目录结构..."

# 创建必要的目录
mkdir -p public/live2d/textures
mkdir -p public/live2d/motions  
mkdir -p public/live2d/expressions

echo "Live2D模型目录创建完成！"
echo ""
echo "请按照以下步骤手动添加Live2D模型："
echo ""
echo "1. 方式一：下载官方示例模型"
echo "   访问：https://www.live2d.com/download/sample-data/"
echo "   下载任意一个Live2D Cubism 3.0+的模型"
echo ""
echo "2. 方式二：使用开源模型"
echo "   GitHub: https://github.com/xiazeyu/live2d-widget-models"
echo "   选择任意一个模型，确保是Cubism 3.0+格式"
echo ""
echo "3. 将模型文件放置到 public/live2d/ 目录："
echo "   - model.json (模型配置文件)"
echo "   - model.moc3 (模型文件)"
echo "   - textures/ (贴图文件夹)"
echo "   - motions/ (动作文件夹，可选)"
echo "   - expressions/ (表情文件夹，可选)"
echo ""
echo "4. 修改 src/components/main/Live2DAvatar.vue 中的 modelPath"
echo "   指向正确的model.json路径"
echo ""
echo "5. 在设置中将Avatar类型切换为Live2D即可体验！"
