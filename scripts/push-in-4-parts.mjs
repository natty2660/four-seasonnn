#!/usr/bin/env node

/**
 * Four Season Cafe - 4-Stage GitHub Push Helper
 *
 * Solves "RPC failed / broken pipe / disconnected" errors on slow or unstable networks
 * by splitting the large image assets into 4 small, lightweight commits (~20-40 MB each)
 * and pushing them sequentially.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

function run(cmd) {
  console.log(`\n> ${cmd}`);
  try {
    execSync(cmd, { stdio: 'inherit' });
    return true;
  } catch (err) {
    console.error(`Command failed: ${cmd}`);
    return false;
  }
}

console.log('====================================================');
console.log('🚀 Four Season Cafe - 4-Stage GitHub Safe Pusher');
console.log('====================================================');

// Step 0: Optimize Git network buffers to prevent timeouts on slow networks
console.log('\n⚙️ Configuring Git network settings (500MB buffer, high timeout)...');
run('git config http.postBuffer 524288000');
run('git config http.lowSpeedLimit 1000');
run('git config http.lowSpeedTime 600');
run('git config core.compression 0');

// Determine current branch name (usually 'main' or 'master')
let branch = 'main';
try {
  branch = execSync('git branch --show-current').toString().trim() || 'main';
} catch {
  branch = 'main';
}

console.log(`\n🌿 Target branch: ${branch}`);

// Unstage anything currently staged to do clean chunking
run('git reset');

// ==========================================
// STAGE 1: Core Code & Configs (< 1 MB)
// ==========================================
console.log('\n----------------------------------------------------');
console.log('📦 STAGE 1/4: Pushing Core Code & Config (< 1 MB)...');
console.log('----------------------------------------------------');

run('git add src/ server.ts vite.config.ts package*.json tsconfig*.json index.html public/downloads/ public/assets/aistudio/ data/ scripts/ .gitignore .env.example README.md');
run('git commit -m "Part 1: Core application code, components, and server config"');
if (!run(`git push -u origin ${branch}`)) {
  console.error('\n❌ Stage 1 push failed. Please check your GitHub remote URL and access token.');
  process.exit(1);
}
console.log('✅ Stage 1 pushed successfully!');

// ==========================================
// STAGE 2: Breakfast, Burger & Pizza (~21 MB)
// ==========================================
console.log('\n----------------------------------------------------');
console.log('📦 STAGE 2/4: Pushing Breakfast, Burger & Pizza images (~21 MB)...');
console.log('----------------------------------------------------');

const imgDir = path.join(process.cwd(), 'public', 'assets', 'images');
if (fs.existsSync(imgDir)) {
  const allFiles = fs.readdirSync(imgDir);

  const stage2Files = allFiles.filter(f =>
    /four_season|bf|omelet|sudanes|fatira|egg|pines|chachbsa|burger|sandwich|bs_|chicken|shawarma|pizza/i.test(f)
  );

  stage2Files.forEach(f => {
    run(`git add "public/assets/images/${f}"`);
  });

  run('git commit -m "Part 2: Breakfast, Burger, Shawarma, and Pizza images"');
  if (!run(`git push origin ${branch}`)) {
    console.error('\n❌ Stage 2 push failed. Try running again to retry.');
    process.exit(1);
  }
  console.log('✅ Stage 2 pushed successfully!');

  // ==========================================
  // STAGE 3: Lunch & Ethiopian Dishes (~35 MB)
  // ==========================================
  console.log('\n----------------------------------------------------');
  console.log('📦 STAGE 3/4: Pushing Lunch & Ethiopian specialty dishes (~35 MB)...');
  console.log('----------------------------------------------------');

  const stage3Files = allFiles.filter(f =>
    !stage2Files.includes(f) &&
    /pasta|rice|firfir|fir_fir|tibs|shiro|wet|kitfo|gomen|mandi|burma|zurbiyan|mahbarawi|eth_|dibs|fuul|cambaabur|makarone|borash|sukhaar/i.test(f)
  );

  stage3Files.forEach(f => {
    run(`git add "public/assets/images/${f}"`);
  });

  run('git commit -m "Part 3: Lunch, traditional Ethiopian dishes, Burma, and Mandi images"');
  if (!run(`git push origin ${branch}`)) {
    console.error('\n❌ Stage 3 push failed. Try running again to retry.');
    process.exit(1);
  }
  console.log('✅ Stage 3 pushed successfully!');

  // ==========================================
  // STAGE 4: Drinks, Juices & Remaining Assets (~80 MB)
  // ==========================================
  console.log('\n----------------------------------------------------');
  console.log('📦 STAGE 4/4: Pushing Drinks, Juices, Mojitos & remaining assets...');
  console.log('----------------------------------------------------');

  run('git add public/');
  run('git commit -m "Part 4: Drinks, Juices, Mojitos, and remaining gallery assets"');
  if (!run(`git push origin ${branch}`)) {
    console.error('\n❌ Stage 4 push failed. Try running again to retry.');
    process.exit(1);
  }
  console.log('✅ Stage 4 pushed successfully!');
}

console.log('\n====================================================');
console.log('🎉 ALL 4 PARTS PUSHED TO GITHUB SUCCESSFULLY!');
console.log('====================================================');
