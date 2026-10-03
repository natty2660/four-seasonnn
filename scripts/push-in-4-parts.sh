#!/usr/bin/env bash
set -e

echo "=== Configuring Git network settings for stable push ==="
git config http.postBuffer 524288000
git config http.lowSpeedLimit 1000
git config http.lowSpeedTime 600
git config core.compression 0

BRANCH=$(git branch --show-current || echo "main")
[ -z "$BRANCH" ] && BRANCH="main"

echo "=== Branch: $BRANCH ==="

# Unstage any existing commits
git reset

# Stage 1: Core Code & Config (< 1MB)
echo "=== Pushing Part 1: Core Code (< 1MB) ==="
git add src/ server.ts vite.config.ts package*.json tsconfig*.json index.html public/downloads/ public/assets/aistudio/ data/ scripts/ .gitignore .env.example README.md
git commit -m "Part 1: Core application code and config"
git push -u origin "$BRANCH"

# Stage 2: Breakfast, Burger & Pizza images (~21MB)
echo "=== Pushing Part 2: Breakfast, Burger & Pizza images (~21MB) ==="
git add public/assets/images/four_season* public/assets/images/item_bf* public/assets/images/item_omelet* public/assets/images/item_sudanes* public/assets/images/item_*fatira* public/assets/images/item_egg* public/assets/images/item_pines* public/assets/images/item_chachbsa* public/assets/images/item_*burger* public/assets/images/item_*sandwich* public/assets/images/item_bs_* public/assets/images/item_full_chicken* public/assets/images/item_*shawarma* public/assets/images/item_*pizza*
git commit -m "Part 2: Breakfast, Burger, Shawarma, and Pizza images"
git push origin "$BRANCH"

# Stage 3: Lunch and Ethiopian Dishes (~35MB)
echo "=== Pushing Part 3: Lunch and Ethiopian dishes (~35MB) ==="
git add public/assets/images/item_*pasta* public/assets/images/item_*rice* public/assets/images/item_*firfir* public/assets/images/item_*fir_fir* public/assets/images/item_*tibs* public/assets/images/item_*shiro* public/assets/images/item_*wet* public/assets/images/item_*kitfo* public/assets/images/item_*gomen* public/assets/images/item_*mandi* public/assets/images/item_*burma* public/assets/images/item_*zurbiyan* public/assets/images/item_mahbarawi* public/assets/images/eth_* public/assets/images/prime_cafe* public/assets/images/primecafe_*
git commit -m "Part 3: Lunch and traditional Ethiopian dish images"
git push origin "$BRANCH"

# Stage 4: Drinks, Mojitos, Juices and remaining assets (~45MB)
echo "=== Pushing Part 4: Drinks, Mojitos, Juices & remaining assets ==="
git add public/
git commit -m "Part 4: Drinks, Mojitos, Juices, and remaining image assets"
git push origin "$BRANCH"

echo "=== All 4 parts pushed to GitHub successfully! ==="
