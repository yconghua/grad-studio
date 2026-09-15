<template>
  <div class="page">
    <h2 class="page-title">仿真模拟 · 后端仿真引擎 API 对接文档</h2>

    <!-- 页内章节小导航（大导航栏「应急疏散」下的小导航栏，点击平滑滚动到对应章节） -->
    <nav class="doc-nav">
      <button
        v-for="(sec, i) in sections"
        :key="sec.id"
        class="doc-chip"
        :class="{ active: activeSec === sec.id }"
        @click="scrollTo(sec.id, i)"
      >{{ i + 1 }}. {{ sec.title }}</button>
    </nav>

    <!-- 第一章：接口总览 -->
    <section id="sec1" class="doc-section">
      <h3 class="doc-h3">1. 接口总览</h3>
      <p class="doc-p">后端仿真引擎服务信息：服务地址 <code class="inline-code">http://127.0.0.1:8000</code>，响应格式 JSON，编码 UTF-8。</p>
      <table class="doc-table">
        <thead>
          <tr><th>方法</th><th>路径</th><th>说明</th></tr>
        </thead>
        <tbody>
          <tr><td><code class="inline-code">GET</code></td><td><code class="inline-code">/health</code></td><td>健康检查，用于判断后端服务是否存活</td></tr>
          <tr><td><code class="inline-code">POST</code></td><td><code class="inline-code">/simulate</code></td><td><strong>核心仿真接口</strong>：提交空间布局与参数，返回完整仿真结果</td></tr>
        </tbody>
      </table>
    </section>

    <!-- 第二章：核心仿真接口 -->
    <section id="sec2" class="doc-section">
      <h3 class="doc-h3">2. 核心仿真接口（POST /simulate）</h3>

      <h4 class="doc-h4">2.1 请求头（Headers）</h4>
      <pre v-pre class="doc-code">Content-Type: application/json</pre>

      <h4 class="doc-h4">2.2 请求体（Request Body）数据结构</h4>
      <pre v-pre class="doc-code">{
  "width": 50,                // 网格列数（X轴方向格子数）
  "height": 40,               // 网格行数（Y轴方向格子数）
  "obstacles": [ [...], ...], // 二维 0/1 数组 [行][列]，1=障碍物
  "exits": [[x1, y1], [x2, y2]], // 出口坐标列表，网格坐标（整数）
  "start_positions": [[x, y], ...], // 行人起始点，世界坐标（浮点数，单位：米）
  "batch_config": [           // 分批释放策略
    {
      "count": 30,            // 本批次释放人数
      "delay": 0.0,           // 相对上一批次的延迟时间（秒）
      "target_speed": 1.34    // 该批次人群期望速度（m/s）
    },
    {
      "count": 20,
      "delay": 5.0,
      "target_speed": 0.8     // 例如：老弱群体慢速
    }
  ]
}</pre>

      <div class="doc-warn">
        <strong>关键字段约束（必读）</strong>
      </div>
      <table class="doc-table">
        <thead>
          <tr><th>字段</th><th>约束与说明</th></tr>
        </thead>
        <tbody>
          <tr><td><code class="inline-code">obstacles</code></td><td><strong>外层数组长度 = height</strong>，<strong>内层数组长度 = width</strong>。即 <code class="inline-code">obstacles[y][x]</code>，<code class="inline-code">y</code> 对应行索引（0~height-1），<code class="inline-code">x</code> 对应列索引（0~width-1）。</td></tr>
          <tr><td><code class="inline-code">exits</code></td><td>网格坐标（整数），取值范围：<code class="inline-code">x</code> ∈ [0, width-1]，<code class="inline-code">y</code> ∈ [0, height-1]。出口网格须为<strong>空地（0）</strong>。</td></tr>
          <tr><td><code class="inline-code">start_positions</code></td><td><strong>世界坐标（浮点数）</strong>，单位为<strong>米</strong>。坐标系原点在地图左下角。每个网格尺寸固定为 <strong>0.4m × 0.4m</strong>。</td></tr>
          <tr><td><code class="inline-code">batch_config</code></td><td>至少包含 1 个批次。<code class="inline-code">delay</code> 是相对上一批次的等待时间，第一个批次的 <code class="inline-code">delay</code> 通常为 0。</td></tr>
        </tbody>
      </table>

      <h4 class="doc-h4">2.3 成功响应（200 OK）数据结构</h4>
      <pre v-pre class="doc-code">{
  "total_evacuation_time": 23.56,   // 全局疏散总时长（秒）
  "flow_curve": [                   // 各出口累计流量时间序列
    {
      "time": 0.5,
      "exit_counts": { "0": 0, "1": 5 }
    }
  ],
  "heatmap_data": [                 // 热力图数据（空间密度矩阵）
    {
      "time": 1.0,
      "data": [ [0.0, 2.5, ...], ... ] // 二维数组 [行][列]，单位：人/m²
    }
  ],
  "bottlenecks": [                  // 关键瓶颈节点（按密度降序）
    {
      "x": 25,
      "y": 18,
      "max_density": 6.8           // 该网格在整个仿真中的最大密度
    }
  ],
  "trajectories": [                 // 核心：每个人物的完整轨迹
    {
      "id": 0,
      "points": [
        [1.2, 2.5, 0.0],           // [世界X, 世界Y, 时间戳(秒)]
        [1.3, 2.6, 0.1],
        ...
        [8.5, 5.2, 12.3]           // 终点（出口附近）或仿真结束位置
      ]
    }
  ]
}</pre>

      <h4 class="doc-h4">各字段用途速查</h4>
      <table class="doc-table">
        <thead>
          <tr><th>字段</th><th>前端使用场景</th></tr>
        </thead>
        <tbody>
          <tr><td><code class="inline-code">trajectories</code></td><td><strong>动画渲染</strong>：驱动人物图标沿轨迹点移动。每个点包含精确的物理坐标和时间戳。</td></tr>
          <tr><td><code class="inline-code">flow_curve</code></td><td><strong>流量图表</strong>：绘制各出口累计通过人数随时间变化的折线图（ECharts / Chart.js）。</td></tr>
          <tr><td><code class="inline-code">heatmap_data</code></td><td><strong>时空热力图</strong>：在沙盘网格上叠加颜色图层，展示人群密度演变。按需取特定时间帧。</td></tr>
          <tr><td><code class="inline-code">bottlenecks</code></td><td><strong>方案评估</strong>：在画布上高亮标记红色方块，提示设计缺陷。</td></tr>
          <tr><td><code class="inline-code">total_evacuation_time</code></td><td><strong>结果展示</strong>：显示最终疏散总耗时，用于方案对比。</td></tr>
        </tbody>
      </table>
    </section>

    <!-- 第三章：坐标系转换 -->
    <section id="sec3" class="doc-section">
      <h3 class="doc-h3">3. 核心难点：坐标系转换（务必仔细阅读）</h3>
      <p class="doc-p">后端使用<strong>两种坐标系统</strong>，前端在发送请求和渲染时必须正确区分。</p>

      <h4 class="doc-h4">3.1 网格坐标（整数）</h4>
      <ul class="doc-list">
        <li><strong>定义</strong>：二维数组索引，用于定义 <code class="inline-code">obstacles</code> 和 <code class="inline-code">exits</code>。</li>
        <li><strong>原点</strong>：左下角 <code class="inline-code">(0, 0)</code>。</li>
        <li><strong>映射关系</strong>：<code class="inline-code">x</code> 对应列索引（向右），<code class="inline-code">y</code> 对应行索引（向上）。</li>
      </ul>

      <h4 class="doc-h4">3.2 世界坐标（浮点数）</h4>
      <ul class="doc-list">
        <li><strong>定义</strong>：以<strong>米</strong>为单位的连续空间坐标，用于 <code class="inline-code">start_positions</code> 和 <code class="inline-code">trajectories</code>。</li>
        <li><strong>原点</strong>：左下角 <code class="inline-code">(0.0, 0.0)</code>。</li>
        <li><strong>转换公式</strong>：
          <div class="doc-formula">网格坐标 → 世界坐标（网格中心）<br>
            worldX = gridX * 0.4 + 0.2<br>
            worldY = gridY * 0.4 + 0.2
          </div>
          <div class="doc-formula">世界坐标 → 网格坐标<br>
            gridX = floor(worldX / 0.4)<br>
            gridY = floor(worldY / 0.4)
          </div>
        </li>
      </ul>

      <h4 class="doc-h4">3.3 前端 Canvas 渲染坐标</h4>
      <p class="doc-p">由于 HTML5 Canvas 的 Y 轴<strong>向下</strong>，而后端世界坐标的 Y 轴<strong>向上</strong>，前端需要在渲染时进行翻转：</p>
      <pre v-pre class="doc-code">// 后端世界坐标 -&gt; Canvas 像素坐标
const pixelX = worldX * pixelScale;
const pixelY = canvasHeight - worldY * pixelScale; // 翻转：Y轴镜像</pre>
      <div class="doc-tip">建议：前端维护一个 <code class="inline-code">pixelScale</code>（如 20px/m），方便缩放查看。</div>
    </section>

    <!-- 第四章：动画实现建议 -->
    <section id="sec4" class="doc-section">
      <h3 class="doc-h3">4. 前端动画实现建议（伪代码）</h3>

      <h4 class="doc-h4">4.1 数据预处理</h4>
      <ul class="doc-list">
        <li>将每个行人的轨迹点按时间升序排列（后端已保证）。</li>
        <li>确认所有点包含 <code class="inline-code">[x, y, time]</code>。</li>
      </ul>

      <h4 class="doc-h4">4.2 动画循环（requestAnimationFrame）</h4>
      <pre v-pre class="doc-code">let simStartTime = performance.now() / 1000; // 起始时间戳

function animate() {
    const currentWorldTime = (performance.now() / 1000) - simStartTime;

    trajectories.forEach(行人 =&gt; {
        // 1. 根据当前世界时间查找所在区间
        const points = 行人.points;
        let idx = points.findIndex(p =&gt; p[2] &gt; currentWorldTime);
        if (idx === -1) idx = points.length - 1;
        if (idx === 0) idx = 1;

        // 2. 线性插值（让移动更平滑）
        const prev = points[idx - 1];
        const next = points[idx];
        const t = (currentWorldTime - prev[2]) / (next[2] - prev[2]);
        const curX = prev[0] + (next[0] - prev[0]) * t;
        const curY = prev[1] + (next[1] - prev[1]) * t;

        // 3. 转换为 Canvas 坐标并绘制
        const px = curX * scale;
        const py = canvasHeight - curY * scale;
        drawCircle(px, py);
    });

    requestAnimationFrame(animate);
}</pre>

      <h4 class="doc-h4">4.3 流量曲线渲染</h4>
      <p class="doc-p">直接将 <code class="inline-code">flow_curve</code> 数据传给 ECharts：</p>
      <pre v-pre class="doc-code">option = {
    xAxis: { data: flow_curve.map(item =&gt; item.time) },
    yAxis: { name: '累计撤离人数' },
    series: [{
        name: '出口1',
        data: flow_curve.map(item =&gt; item.exit_counts['0'] || 0)
    }]
};</pre>

      <h4 class="doc-h4">4.4 热力图叠加</h4>
      <ul class="doc-list">
        <li>取 <code class="inline-code">heatmap_data</code> 中某一帧（如最后一帧），用 Canvas 绘制半透明矩形覆盖在网格上。</li>
        <li>颜色映射：低密度（绿色）→ 中密度（黄色）→ 高密度（红色）。</li>
        <li>每个网格像素范围：<code class="inline-code">(x * cellSize * scale, (height - y - 1) * cellSize * scale)</code>。</li>
      </ul>
    </section>

    <!-- 第五章：错误处理 -->
    <section id="sec5" class="doc-section">
      <h3 class="doc-h3">5. 错误处理（HTTP 状态码）</h3>
      <table class="doc-table">
        <thead>
          <tr><th>状态码</th><th>含义</th><th>前端处理</th></tr>
        </thead>
        <tbody>
          <tr><td><code class="inline-code">200</code></td><td>仿真成功</td><td>正常解析并渲染</td></tr>
          <tr><td><code class="inline-code">422</code></td><td>请求参数校验失败</td><td>检查 JSON 格式或数值范围</td></tr>
          <tr><td><code class="inline-code">500</code></td><td>服务器内部错误（如算法崩溃）</td><td>弹窗提示「仿真计算异常」，检查日志</td></tr>
          <tr><td><code class="inline-code">504</code></td><td>仿真超时</td><td>提示「人群过多，请减少人数或简化地图」</td></tr>
        </tbody>
      </table>
    </section>

    <!-- 第六章：性能限制与建议 -->
    <section id="sec6" class="doc-section">
      <h3 class="doc-h3">6. 性能限制与建议</h3>
      <ul class="doc-list">
        <li><strong>单次仿真人数上限</strong>：建议 ≤ <strong>500人</strong>。</li>
        <li><strong>响应数据量</strong>：500人的完整轨迹约 5~10 MB（取决于仿真时长）。建议前端开启 Gzip 或使用 <code class="inline-code">fetch</code> 流式处理（暂不支持）。</li>
        <li><strong>防抖处理</strong>：用户点击「开始模拟」后，<strong>禁用按钮</strong>并显示 Loading，防止重复提交导致服务过载。</li>
      </ul>
    </section>

    <!-- 第七章：联调检查清单 -->
    <section id="sec7" class="doc-section">
      <h3 class="doc-h3">7. 联调检查清单（给前端自测用）</h3>
      <ul class="doc-check">
        <li>发送的 <code class="inline-code">obstacles</code> 矩阵维度与 <code class="inline-code">width</code>/<code class="inline-code">height</code> 是否匹配？</li>
        <li><code class="inline-code">exits</code> 坐标是否在 <code class="inline-code">obstacles</code> 中为 <strong>0</strong>（空地）？</li>
        <li><code class="inline-code">start_positions</code> 是否传的是世界坐标（带小数），而不是网格坐标（整数）？</li>
        <li>渲染时是否对 Y 轴做了翻转处理？</li>
        <li>流量曲线中 <code class="inline-code">exit_counts</code> 的 key 是否为字符串（JSON 特性），取数时用 <code class="inline-code">['0']</code> 还是 <code class="inline-code">.0</code>？</li>
      </ul>
    </section>

    <!-- 第八章：扩展说明 -->
    <section id="sec8" class="doc-section">
      <h3 class="doc-h3">8. 扩展说明：如果前端需要「暂停 / 调速」</h3>
      <p class="doc-p">后端返回的 <code class="inline-code">trajectories</code> 带有绝对时间戳，前端完全可以实现：</p>
      <ul class="doc-list">
        <li><strong>调速</strong>：在 <code class="inline-code">animate</code> 循环中引入 <code class="inline-code">speedRatio</code> 乘数。</li>
        <li><strong>暂停 / 拖拽进度条</strong>：直接控制 <code class="inline-code">currentWorldTime</code> 的值，任意跳转到指定时刻，实现「时空回放」。</li>
      </ul>
      <div class="doc-tip">有任何问题，欢迎后端协助排查。祝联调顺利！</div>
    </section>
  </div>
</template>

<script setup>
import { ref } from 'vue'

// 页内章节小导航配置（与下方 <section id="secN"> 一一对应）
const sections = [
  { id: 'sec1', title: '接口总览' },
  { id: 'sec2', title: '核心仿真接口' },
  { id: 'sec3', title: '坐标系转换' },
  { id: 'sec4', title: '动画实现建议' },
  { id: 'sec5', title: '错误处理' },
  { id: 'sec6', title: '性能限制与建议' },
  { id: 'sec7', title: '联调检查清单' },
  { id: 'sec8', title: '扩展说明' }
]

const activeSec = ref('')

// 点击章节小导航：平滑滚动到对应内容块
function scrollTo(id, index) {
  activeSec.value = id
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>

<style scoped>
.page {
  min-height: 100%;
}
.page-title {
  font-size: 18px;
  font-weight: 700;
  margin: 0 0 16px;
}

/* 页内章节小导航条：吸顶显示，方便随时跳转 */
.doc-nav {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px 12px;
  margin-bottom: 16px;
  background: #fff;
  border: 1px solid #eceff3;
  border-radius: 10px;
}
.doc-chip {
  padding: 6px 12px;
  font-size: 13px;
  color: #4e5969;
  background: #f5f7fa;
  border: 1px solid #eceff3;
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}
.doc-chip:hover {
  border-color: #0d80e0;
  color: #0d80e0;
}
.doc-chip.active {
  background: #eef6ff;
  border-color: #0d80e0;
  color: #0d80e0;
  font-weight: 600;
}

/* 章节内容卡片 */
.doc-section {
  background: #fff;
  border: 1px solid #eceff3;
  border-radius: 10px;
  padding: 20px 24px;
  margin-bottom: 16px;
  scroll-margin-top: 8px;
}
.doc-h3 {
  font-size: 16px;
  font-weight: 700;
  margin: 0 0 12px;
  padding-left: 10px;
  border-left: 3px solid #0d80e0;
}
.doc-h4 {
  font-size: 14px;
  font-weight: 600;
  margin: 16px 0 8px;
  color: #1f2329;
}
.doc-p {
  font-size: 13px;
  color: #4e5969;
  line-height: 1.7;
  margin: 0 0 10px;
}
.doc-list {
  margin: 0 0 10px;
  padding-left: 20px;
  font-size: 13px;
  color: #4e5969;
  line-height: 1.9;
}
.doc-check {
  margin: 0;
  padding-left: 0;
  list-style: none;
  font-size: 13px;
  color: #4e5969;
  line-height: 2;
}
.doc-check li::before {
  content: '☐ ';
  color: #0d80e0;
  font-weight: 700;
}

/* 表格 */
.doc-table {
  width: 100%;
  border-collapse: collapse;
  margin: 8px 0 12px;
  font-size: 13px;
  color: #4e5969;
}
.doc-table th {
  background: #f5f7fa;
  color: #1f2329;
  font-weight: 600;
  text-align: left;
  padding: 8px 12px;
  border: 1px solid #eceff3;
}
.doc-table td {
  padding: 8px 12px;
  border: 1px solid #eceff3;
  line-height: 1.6;
}

/* 代码块与内联代码 */
.doc-code {
  margin: 8px 0 12px;
  padding: 12px 16px;
  background: #f7f8fa;
  border: 1px solid #eceff3;
  border-radius: 8px;
  font-family: Consolas, Monaco, 'Courier New', monospace;
  font-size: 12.5px;
  line-height: 1.7;
  color: #1f2329;
  overflow-x: auto;
  white-space: pre;
}
.inline-code {
  font-family: Consolas, Monaco, 'Courier New', monospace;
  font-size: 12.5px;
  background: #f0f2f5;
  padding: 1px 5px;
  border-radius: 4px;
  color: #0c447c;
}

/* 公式框 / 提示框 / 警告框 */
.doc-formula {
  margin: 8px 0;
  padding: 8px 14px;
  background: #f7f8fa;
  border-left: 3px solid #378add;
  border-radius: 4px;
  font-family: Consolas, Monaco, 'Courier New', monospace;
  font-size: 12.5px;
  line-height: 1.8;
  color: #1f2329;
}
.doc-tip {
  margin: 8px 0;
  padding: 8px 14px;
  background: #eaf3de;
  border-left: 3px solid #639922;
  border-radius: 4px;
  font-size: 13px;
  color: #27500a;
}
.doc-warn {
  margin: 8px 0;
  padding: 8px 14px;
  background: #fcebeb;
  border-left: 3px solid #e24b4a;
  border-radius: 4px;
  font-size: 13px;
  color: #791f1f;
}
</style>
