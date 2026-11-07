# 来源与实现说明

- Three.js r128：沿用前版本地依赖，MIT 许可。许可证在 `assets/vendor/THREE-LICENSE.txt`。上游：<https://github.com/mrdoob/three.js/tree/r128>
- Particle Cake：参考蛋糕散开与粒子重组的交互概念。本版独立实现蛋糕几何、shader、手势和演出流程，没有载入该项目运行库。上游：<https://github.com/VignaChu/particle-cake>
- 月光情书互动 H5：参考月色、粒子和光线的氛围方向；没有复制该仓库的文字、图片、音乐或代码。上游：<https://github.com/keyingshuzhi/moonlight-love-letter-h5>
- 用户提供的概念图：用于银蓝色题字、深色空间、长光线和 OC 风格参考。最终称呼与祝福按用户本次要求，使用「祝：小林子17岁生日快乐」。
- OC 图片：由当前任务此前保存的 `outputs/ling-lan-birthday-v3/assets/oc-02-full.webp` 适配得到，输出为 1024 × 1536 的深色空间立绘，保留人物头发、裙摆和鞋子并增加留边。WebGL 与 Canvas 都会从角色像素生成聚合粒子；WebGL 通过背景色键清理深色底。可编辑源图为 `assets/oc-portrait.webp`；内嵌副本为 `assets/oc-portrait-data.js`，两者图片数据相同。详细来源和适配方式见 `assets/oc-portrait.webp.json`。本次 Right Code 参考生成请求超时，没有返回新生成图片。
- 星云、月面、光蝶、晶体星、流星、光轨、粒子重组、镜面、水波、触点折射、烟花、手势 SVG 光迹：本地程序生成。月面点击是隐藏触发点。
- 声音：用户主动开启后通过 Web Audio 在本地合成，无远程音乐请求。

本交付包不发起外链素材、远程字体、账号或音频请求。尚未进行真实手机或微信内置浏览器的视觉与帧率实测。
