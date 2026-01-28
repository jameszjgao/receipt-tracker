#!/bin/bash

# iOS 构建环境安装脚本
# 用于检查和安装 iOS 开发所需的工具

set -e

echo "🚀 iOS 构建环境安装脚本"
echo "=========================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 检查 Xcode
echo "📱 检查 Xcode..."
if command -v xcodebuild &> /dev/null; then
    XCODE_VERSION=$(xcodebuild -version 2>&1 | head -1)
    echo -e "${GREEN}✅ Xcode 已安装: $XCODE_VERSION${NC}"
    
    # 检查 Command Line Tools
    if xcode-select -p &> /dev/null; then
        echo -e "${GREEN}✅ Command Line Tools 已安装${NC}"
    else
        echo -e "${YELLOW}⚠️  Command Line Tools 未安装，正在安装...${NC}"
        xcode-select --install || echo -e "${RED}❌ 安装失败，请手动运行: xcode-select --install${NC}"
    fi
    
    # 检查许可协议
    echo "检查 Xcode 许可协议..."
    if sudo xcodebuild -license check &> /dev/null; then
        echo -e "${GREEN}✅ Xcode 许可协议已接受${NC}"
    else
        echo -e "${YELLOW}⚠️  需要接受 Xcode 许可协议${NC}"
        echo "运行: sudo xcodebuild -license accept"
    fi
else
    echo -e "${RED}❌ Xcode 未安装${NC}"
    echo "请从 App Store 安装 Xcode:"
    echo "1. 打开 App Store"
    echo "2. 搜索 'Xcode'"
    echo "3. 点击 '获取' 或 '安装'"
    echo ""
    echo "或者访问: https://developer.apple.com/xcode/"
    exit 1
fi

echo ""

# 检查 Ruby
echo "💎 检查 Ruby..."
if command -v ruby &> /dev/null; then
    RUBY_VERSION=$(ruby --version)
    echo -e "${GREEN}✅ Ruby 已安装: $RUBY_VERSION${NC}"
else
    echo -e "${RED}❌ Ruby 未安装${NC}"
    echo "macOS 通常自带 Ruby，如果未找到，请检查系统配置"
    exit 1
fi

echo ""

# 检查 CocoaPods
echo "☕ 检查 CocoaPods..."
if command -v pod &> /dev/null; then
    POD_VERSION=$(pod --version)
    echo -e "${GREEN}✅ CocoaPods 已安装: $POD_VERSION${NC}"
else
    echo -e "${YELLOW}⚠️  CocoaPods 未安装，正在安装...${NC}"
    
    # 尝试系统安装
    if sudo gem install cocoapods 2>/dev/null; then
        echo -e "${GREEN}✅ CocoaPods 安装成功${NC}"
    else
        echo -e "${YELLOW}⚠️  系统安装失败，尝试用户目录安装...${NC}"
        if gem install cocoapods --user-install; then
            RUBY_VERSION=$(ruby -e "puts RUBY_VERSION[/\d+\.\d+/]")
            export PATH="$HOME/.gem/ruby/$RUBY_VERSION/bin:$PATH"
            echo 'export PATH="$HOME/.gem/ruby/$RUBY_VERSION/bin:$PATH"' >> ~/.zshrc
            echo -e "${GREEN}✅ CocoaPods 安装成功（用户目录）${NC}"
            echo -e "${YELLOW}⚠️  已添加到 PATH，请运行: source ~/.zshrc${NC}"
        else
            echo -e "${RED}❌ CocoaPods 安装失败${NC}"
            echo "请手动运行: sudo gem install cocoapods"
            exit 1
        fi
    fi
fi

echo ""

# 检查 Node.js 和 npm
echo "📦 检查 Node.js 和 npm..."
if command -v node &> /dev/null && command -v npm &> /dev/null; then
    NODE_VERSION=$(node --version)
    NPM_VERSION=$(npm --version)
    echo -e "${GREEN}✅ Node.js: $NODE_VERSION${NC}"
    echo -e "${GREEN}✅ npm: $NPM_VERSION${NC}"
else
    echo -e "${RED}❌ Node.js 或 npm 未安装${NC}"
    echo "请安装 Node.js: https://nodejs.org/"
    exit 1
fi

echo ""

# 检查 Expo CLI
echo "⚡ 检查 Expo CLI..."
if command -v expo &> /dev/null || npx expo --version &> /dev/null; then
    echo -e "${GREEN}✅ Expo CLI 可用${NC}"
else
    echo -e "${YELLOW}⚠️  Expo CLI 未全局安装（可以使用 npx）${NC}"
fi

echo ""

# 检查项目依赖
echo "📚 检查项目依赖..."
if [ -f "package.json" ]; then
    if [ -d "node_modules" ]; then
        echo -e "${GREEN}✅ node_modules 目录存在${NC}"
    else
        echo -e "${YELLOW}⚠️  node_modules 不存在，正在安装...${NC}"
        npm install
    fi
else
    echo -e "${RED}❌ 未找到 package.json${NC}"
    exit 1
fi

echo ""

# 检查 iOS 目录
echo "🍎 检查 iOS 项目..."
if [ -d "ios" ]; then
    echo -e "${GREEN}✅ ios 目录存在${NC}"
    
    # 检查 Podfile
    if [ -f "ios/Podfile" ]; then
        echo -e "${GREEN}✅ Podfile 存在${NC}"
        
        # 检查 Pods
        if [ -d "ios/Pods" ]; then
            echo -e "${GREEN}✅ Pods 已安装${NC}"
        else
            echo -e "${YELLOW}⚠️  Pods 未安装，正在安装...${NC}"
            cd ios
            pod install
            cd ..
            echo -e "${GREEN}✅ Pods 安装完成${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  Podfile 不存在，需要预构建${NC}"
        echo "运行: npx expo prebuild --platform ios"
    fi
else
    echo -e "${YELLOW}⚠️  ios 目录不存在，需要预构建${NC}"
    echo "运行: npx expo prebuild --platform ios"
fi

echo ""
echo "=========================="
echo -e "${GREEN}✅ 环境检查完成！${NC}"
echo ""
echo "下一步："
echo "1. 如果 ios 目录不存在，运行: npx expo prebuild --platform ios"
echo "2. 如果 Pods 未安装，运行: cd ios && pod install && cd .."
echo "3. 运行应用: npx expo run:ios"
echo ""
