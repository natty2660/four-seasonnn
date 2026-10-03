@echo off
echo ====================================================
echo Four Season Cafe - 4-Stage GitHub Safe Pusher (Windows)
echo ====================================================

echo Configuring Git network buffers...
git config http.postBuffer 524288000
git config http.lowSpeedLimit 1000
git config http.lowSpeedTime 600
git config core.compression 0

git reset

echo.
echo [1/4] Pushing Core Code and Configuration files...
git add src/ server.ts vite.config.ts package*.json tsconfig*.json index.html public/downloads/ public/assets/aistudio/ data/ scripts/ .gitignore .env.example README.md
git commit -m "Part 1: Core application code and config"
git push -u origin main
if errorlevel 1 git push -u origin master

echo.
echo [2/4] Pushing Breakfast, Burger and Pizza images (~21MB)...
git add public/assets/images/four_season* public/assets/images/item_bf* public/assets/images/item_omelet* public/assets/images/item_sudanes* public/assets/images/item_*fatira* public/assets/images/item_egg* public/assets/images/item_pines* public/assets/images/item_chachbsa* public/assets/images/item_*burger* public/assets/images/item_*sandwich* public/assets/images/item_bs_* public/assets/images/item_full_chicken* public/assets/images/item_*shawarma* public/assets/images/item_*pizza*
git commit -m "Part 2: Breakfast, Burger, Shawarma, and Pizza images"
git push origin main
if errorlevel 1 git push origin master

echo.
echo [3/4] Pushing Lunch and Ethiopian dishes (~35MB)...
git add public/assets/images/item_*pasta* public/assets/images/item_*rice* public/assets/images/item_*firfir* public/assets/images/item_*fir_fir* public/assets/images/item_*tibs* public/assets/images/item_*shiro* public/assets/images/item_*wet* public/assets/images/item_*kitfo* public/assets/images/item_*gomen* public/assets/images/item_*mandi* public/assets/images/item_*burma* public/assets/images/item_*zurbiyan* public/assets/images/item_mahbarawi* public/assets/images/eth_* public/assets/images/prime_cafe* public/assets/images/primecafe_*
git commit -m "Part 3: Lunch and traditional Ethiopian dish images"
git push origin main
if errorlevel 1 git push origin master

echo.
echo [4/4] Pushing Drinks, Mojitos, Juices and remaining assets...
git add public/
git commit -m "Part 4: Drinks, Mojitos, Juices, and remaining image assets"
git push origin main
if errorlevel 1 git push origin master

echo.
echo ====================================================
echo All 4 parts pushed to GitHub successfully!
echo ====================================================
pause
