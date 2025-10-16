import { useMemo, useState } from "react";
import "./App.css";

/** ====== 基础数据（材料库） ====== */
const MATERIAL_OPTIONS = [
  { name: "PET-12μm", type: "plastic", density: 1.4, thickness: 12, pricePerKg: 8 },
  { name: "PET-15μm", type: "plastic", density: 1.4, thickness: 15, pricePerKg: 8.2 },
  { name: "VMPET-12μm", type: "plastic", density: 1.4, thickness: 12, pricePerKg: 9 },
  { name: "VMPET-15μm", type: "plastic", density: 1.4, thickness: 15, pricePerKg: 9.2 },
  { name: "BOPP-25μm", type: "plastic", density: 0.91, thickness: 25, pricePerKg: 8.8 },
  { name: "CPP-40μm", type: "plastic", density: 0.91, thickness: 40, pricePerKg: 9.5 },
  { name: "PE-90μm", type: "plastic", density: 0.92, thickness: 90, pricePerKg: 10.16 },
  { name: "牛皮纸-80g", type: "paper", grammage: 80, pricePerKg: 7.2 },
  { name: "白牛皮纸-80g", type: "paper", grammage: 80, pricePerKg: 8.2 },
  { name: "自定义…", type: "custom" } as any,
] as const;

type BagType = "站立袋" | "三边封袋" | "中封袋" | "风琴袋" | "八边封袋";
type PrintCoverage = "25" | "50" | "100" | "150" | "200" | "300";
type LamMethod = "干复" | "干复蒸煮" | "无溶剂";

const PRINT_PRICE: Record<PrintCoverage, number> = {
  "25": 0.11, "50": 0.13, "100": 0.16, "150": 0.21, "200": 0.26, "300": 0.36,
};
const LAM_PRICE: Record<LamMethod, number> = {
  "干复": 0.13, "干复蒸煮": 0.18, "无溶剂": 0.065,
};
const BAG_MAKE_RULES = {
  standup: { noZipper: 0.09, zipper: 0.19 },
};
const SETUP = { perColor: 200 };
const PLATE = { pricePerCm2: 0.11 };

function money(v: number, prefix = "¥") {
  return prefix + (isFinite(v) ? v.toFixed(5).replace(/0+$/, "0") : "0.00");
}

export default function App() {
  /** === 输入参数 === */
  const [bagType, setBagType] = useState<BagType>("站立袋");
  const [width, setWidth] = useState(300);
  const [height, setHeight] = useState(190);
  const [bottomInsert, setBottomInsert] = useState(40);
  const [quantity, setQuantity] = useState(30000);
  const [fxRate, setFxRate] = useState(7.2);
  const [debug, setDebug] = useState(false);

  /** === 材料层 === */
  const [layers, setLayers] = useState([
    { id: 1, name: "PET-12μm" },
    { id: 2, name: "VMPET-12μm" },
    { id: 3, name: "PE-90μm" },
  ]);

  /** === 覆盖率 & 复合方式 === */
  const [coverage, setCoverage] = useState<PrintCoverage>("300");
  const [joins, setJoins] = useState<LamMethod[]>(["干复", "无溶剂"]);
  const [zipper, setZipper] = useState(true);

  /** === 版费 & 上机费 === */
  const [plateCount, setPlateCount] = useState(3);
  const [plateLen, setPlateLen] = useState(86);
  const [plateRound, setPlateRound] = useState(19);
  const [colorCount, setColorCount] = useState(3);

  /** === 计算部分 === */
  const areaM2 = useMemo(() => {
    if (bagType === "站立袋") {
      return (0.19 * (0.3 + 0.04) * 2);
    }
    return 0;
  }, [bagType, width, height, bottomInsert]);

  /** 材料成本 */
  const materialDetails = layers.map((layer) => {
    const def = MATERIAL_OPTIONS.find(m => m.name === layer.name);
    if (!def) return { name: layer.name, cost: 0 };
    if (def.type === "plastic") {
      const cost = areaM2 * def.thickness * def.density * def.pricePerKg / 100;
      return { name: layer.name, cost };
    } else {
      const cost = areaM2 * def.grammage * def.pricePerKg / 1000;
      return { name: layer.name, cost };
    }
  });
  const materialTotal = materialDetails.reduce((a, b) => a + b.cost, 0);

  /** 印刷 */
  const printCost = areaM2 * PRINT_PRICE[coverage];

  /** 复合 */
  const lamTotal = joins.reduce((sum, j) => sum + areaM2 * LAM_PRICE[j], 0);

  /** 制袋 */
  const bagMake = 0.19 * 0.19; // 站立袋带拉链

  /** 单袋成本（不含版费） */
  const perBag = materialTotal + printCost + lamTotal + bagMake;

  /** 版费 */
  const plateTotal = plateLen * plateRound * plateCount * PLATE.pricePerCm2;

  /** 上机费 */
  const setupTotal = colorCount * SETUP.perColor;

  /** 总价 */
  const total = perBag * quantity + plateTotal + setupTotal;

  return (
    <div className="app">
      <h1>📦 包装袋自动报价系统</h1>
      <button onClick={() => setDebug(d => !d)}>
        {debug ? "关闭验证模式" : "开启验证模式"}
      </button>

      <div className="section">
        <h2>输入参数</h2>
        <div className="grid-six">
          <div>
            <label>袋型</label>
            <select value={bagType} onChange={e => setBagType(e.target.value as BagType)}>
              <option value="站立袋">站立袋</option>
            </select>
          </div>
          <div>
            <label>宽(mm)</label>
            <input value={width} onChange={e => setWidth(Number(e.target.value))} />
          </div>
          <div>
            <label>高(mm)</label>
            <input value={height} onChange={e => setHeight(Number(e.target.value))} />
          </div>
          <div>
            <label>底插入(mm)</label>
            <input value={bottomInsert} onChange={e => setBottomInsert(Number(e.target.value))} />
          </div>
          <div>
            <label>数量</label>
            <input value={quantity} onChange={e => setQuantity(Number(e.target.value))} />
          </div>
          <div>
            <label>美元汇率</label>
            <input value={fxRate} onChange={e => setFxRate(Number(e.target.value))} />
          </div>
        </div>
      </div>

      <div className="section">
        <h2>报价结果</h2>
        <div className="highlight">
          <p>单袋成本：{money(perBag)} 元（不含版费）</p>
          <p>版费：{money(plateTotal)} 元</p>
          <p>上机费：{money(setupTotal)} 元</p>
          <p>订单总价：{money(total)} 元 / {money(total / fxRate, "$")}</p>
        </div>
      </div>

      {debug && (
        <div className="section" style={{ background: "#f5f5f5", padding: 10 }}>
          <h3>🧮 验证模式（显示所有中间过程）</h3>
          <p>展开面积：{areaM2.toFixed(6)} m²</p>
          <ul>
            {materialDetails.map(m => (
              <li key={m.name}>{m.name} → {money(m.cost)} 元</li>
            ))}
          </ul>
          <p>材料合计：{money(materialTotal)} 元</p>
          <p>印刷：面积×0.36 = {money(printCost)} 元</p>
          <p>复合：干复 {money(areaM2 * 0.13)} + 无溶剂 {money(areaM2 * 0.065)} = {money(lamTotal)} 元</p>
          <p>制袋：0.19×0.19 = {money(bagMake)} 元</p>
          <p>单袋总价 = {money(perBag)} 元</p>
          <hr />
          <p>版费：{plateLen}×{plateRound}×{plateCount}×0.11 = {money(plateTotal)} 元</p>
          <p>上机费：{colorCount}×200 = {money(setupTotal)} 元</p>
        </div>
      )}
    </div>
  );
}
