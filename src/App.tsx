import { useMemo, useState } from "react";
import "./App.css";

/** ====== 基础数据 ====== */

// 材料库（包含不同规格的同种材料）
const MATERIAL_OPTIONS = [
  // PET系列
  { name: "PET-12μm", type: "plastic", density: 1.4, thickness: 12, pricePerKg: 8 },
  { name: "PET-15μm", type: "plastic", density: 1.4, thickness: 15, pricePerKg: 8.2 },
  { name: "VMPET-12μm", type: "plastic", density: 1.4, thickness: 12, pricePerKg: 9 },
  { name: "VMPET-15μm", type: "plastic", density: 1.4, thickness: 15, pricePerKg: 9.2 },
  
  // BOPP系列
  { name: "BOPP-20μm", type: "plastic", density: 0.91, thickness: 20, pricePerKg: 8.5 },
  { name: "BOPP-25μm", type: "plastic", density: 0.91, thickness: 25, pricePerKg: 8.8 },
  { name: "BOPP-30μm", type: "plastic", density: 0.91, thickness: 30, pricePerKg: 9.1 },
  
  // CPP系列
  { name: "CPP-25μm", type: "plastic", density: 0.91, thickness: 25, pricePerKg: 9 },
  { name: "CPP-30μm", type: "plastic", density: 0.91, thickness: 30, pricePerKg: 9.2 },
  { name: "CPP-40μm", type: "plastic", density: 0.91, thickness: 40, pricePerKg: 9.5 },
  { name: "VMCPP-25μm", type: "plastic", density: 0.91, thickness: 25, pricePerKg: 11 },
  { name: "VMCPP-30μm", type: "plastic", density: 0.91, thickness: 30, pricePerKg: 11.2 },
  
  // PE系列
  { name: "PE-30μm", type: "plastic", density: 0.92, thickness: 30, pricePerKg: 9.2 },
  { name: "PE-40μm", type: "plastic", density: 0.92, thickness: 40, pricePerKg: 9.5 },
  { name: "PE-50μm", type: "plastic", density: 0.92, thickness: 50, pricePerKg: 9.8 },
  
  // BOPA系列
  { name: "BOPA-15μm", type: "plastic", density: 1.16, thickness: 15, pricePerKg: 17 },
  { name: "BOPA-20μm", type: "plastic", density: 1.16, thickness: 20, pricePerKg: 17.5 },
  
  // 纸类
  { name: "牛皮纸-60g", type: "paper", grammage: 60, pricePerKg: 7 },
  { name: "牛皮纸-80g", type: "paper", grammage: 80, pricePerKg: 7.2 },
  { name: "白牛皮纸-60g", type: "paper", grammage: 60, pricePerKg: 8 },
  { name: "白牛皮纸-80g", type: "paper", grammage: 80, pricePerKg: 8.2 },
  { name: "棉纸-19g", type: "paper", grammage: 19, pricePerKg: 11 },
] as const;

// type MaterialDef = (typeof MATERIAL_OPTIONS)[number]; // 暂时未使用

type Unit = "cm" | "inch";
type BagType = "站立袋" | "三边封袋" | "中封袋" | "风琴袋" | "八边封袋";
type PrintCoverage = "25" | "50" | "100" | "150" | "200" | "300";
type Lamination = "干复" | "干复蒸煮" | "无溶剂";

// 印刷覆盖率单价（元/㎡）
const PRINT_PRICES: Record<PrintCoverage, number> = {
  "25": 0.11, "50": 0.13, "100": 0.16, "150": 0.21, "200": 0.26, "300": 0.36,
};

// 复合单价（元/㎡）
const LAM_PRICES: Record<Lamination, number> = {
  "干复": 0.13, "干复蒸煮": 0.18, "无溶剂": 0.065,
};

// 制袋单价（元/米）
const BAG_MAKE_RULES = {
  standup: { noZipper: 0.09, zipper: 0.19 },
  threeSide: { "单排": 0.045, "双排": 0.03, "三排": 0.0225 },
  centerAndGussetPerMeterHeight: 0.04,
  eightSide: { noZipper: 0.28, zipperNormal: 0.5, zipperEasyTear: 0.75 },
};

// 附加工艺
const EXTRA = {
  foilAreaPricePerM2: 1.2, foilPerTimeSingleRow: 0.2, foilPerTimeDoubleRowAdd: 0.1,
  valvePerUnit: 0.11, handlePerUnit: 0.15,
};

// 人工（基于"带宽"阈值）
const LABOR = { thresholdCm: 14, small: 0.024, large: 0.026 };

// 上机与版费
const SETUP = { perColor: 200, maxColors: 9, platePerCm2: 0.11, filmWidthMaxMm: 1050 };

// 数量折扣
function moqDiscount(qty: number) {
  if (qty >= 100000) return 0.96;
  if (qty >= 50000) return 0.98;
  if (qty >= 30000) return 1.0;
  if (qty >= 20000) return 1.15;
  if (qty >= 10000) return 1.3;
  return 1.4;
}

/** ====== 工具函数 ====== */
const inchToCm = (inch: number) => inch * 2.54;
const cmToM = (cm: number) => cm / 100;
const cm2ToM2 = (cm2: number) => cm2 / 10000;

function moneyRMB(v: number) {
  if (!isFinite(v)) return "¥0.00";
  return "¥" + v.toFixed(2);
}
function moneyUSD(v: number, rate: number) {
  if (!isFinite(v) || rate <= 0) return "$0.00";
  return "$" + (v / rate).toFixed(2);
}

/** ====== 类型 ====== */
interface Layer {
  id: number;
  materialName: string;
}

/** ====== 主组件 ====== */
export default function App() {
  // --- 基础输入 ---
  const [unit, setUnit] = useState<Unit>("cm");
  const [bagType, setBagType] = useState<BagType>("站立袋");
  const [width, setWidth] = useState<number>(0);
  const [height, setHeight] = useState<number>(0);
  const [bottomInsert, setBottomInsert] = useState<number>(0);
  const [backSeam, setBackSeam] = useState<number>(1);
  const [sideGusset, setSideGusset] = useState<number>(0);
  const [rows, setRows] = useState<"单排" | "双排" | "三排">("单排");
  const [quantity, setQuantity] = useState<number>(0);

  // --- 多层材料 ---
  const [layers, setLayers] = useState<Layer[]>([
    { id: 1, materialName: "PET-12μm" },
    { id: 2, materialName: "PE-40μm" },
  ]);

  // --- 印刷 / 复合 / 拉链 ---
  const [coverage, setCoverage] = useState<PrintCoverage>("100");
  const [lamination, setLamination] = useState<Lamination>("干复");
  const [zipper, setZipper] = useState<"否" | "是" | "易撕拉链">("否");

  // --- 高级选项 & 汇率 ---
  const [foilRow, setFoilRow] = useState<"无" | "单排" | "双排">("无");
  const [foilAreaCm2, setFoilAreaCm2] = useState<number>(0);
  const [valveCount, setValveCount] = useState<number>(0);
  const [handleCount, setHandleCount] = useState<number>(0);
  const [fxRate, setFxRate] = useState<number>(7.2);

  // 人工按带宽判断
  const laborPerBag = useMemo(
    () => (width <= LABOR.thresholdCm ? LABOR.small : LABOR.large),
    [width]
  );

  /** ============ 尺寸统一到 cm ============ */
  const widthCm = unit === "inch" ? inchToCm(width) : width;
  const heightCm = unit === "inch" ? inchToCm(height) : height;
  const bottomInsertCm = unit === "inch" ? inchToCm(bottomInsert) : bottomInsert;
  const backSeamCm = unit === "inch" ? inchToCm(backSeam) : backSeam;
  const sideGussetCm = unit === "inch" ? inchToCm(sideGusset) : sideGusset;

  /** ============ 展开面积（cm²/袋） ============ */
  const areaCm2 = useMemo(() => {
    switch (bagType) {
      case "站立袋": return widthCm * (heightCm + bottomInsertCm) * 2;
      case "三边封袋": return widthCm * heightCm * 2;
      case "中封袋": return (widthCm * 2 + backSeamCm * 2) * heightCm;
      case "风琴袋": return (widthCm * 2 + backSeamCm * 2 + sideGussetCm * 2) * heightCm;
      case "八边封袋": return (
          (heightCm + heightCm + bottomInsertCm + 3) * (widthCm + 0.6) +
          (sideGussetCm + 0.6) * 2 * (heightCm + 1)
        );
      default: return widthCm * heightCm * 2;
    }
  }, [bagType, widthCm, heightCm, bottomInsertCm, backSeamCm, sideGussetCm]);

  const areaM2 = cm2ToM2(areaCm2);

  /** ============ 材料成本合计（元/袋） ============ */
  const materialCostPerBag = useMemo(() => {
    let sum = 0;
    layers.forEach((layer) => {
      const def = MATERIAL_OPTIONS.find((m) => m.name === layer.materialName);
      if (!def) return;

      if (def.type === "plastic") {
        const thicknessCm = def.thickness / 10000;
        const volumeCm3 = areaCm2 * thicknessCm;
        const weightG = volumeCm3 * def.density;
        const weightKg = weightG / 1000;
        const cost = weightKg * def.pricePerKg;
        sum += cost;
      } else {
        const weightG = areaM2 * def.grammage;
        const weightKg = weightG / 1000;
        const cost = weightKg * def.pricePerKg;
        sum += cost;
      }
    });
    return sum;
  }, [layers, areaCm2, areaM2]);

  /** ============ 各项成本 ============ */
  const printCostPerBag = useMemo(() => areaM2 * PRINT_PRICES[coverage], [areaM2, coverage]);
  const lamCostPerBag = useMemo(() => areaM2 * LAM_PRICES[lamination] * Math.max(layers.length - 1, 0), [areaM2, lamination, layers.length]);
  
  const bagMakeCostPerBag = useMemo(() => {
    if (bagType === "站立袋") {
      const rate = zipper === "是" ? BAG_MAKE_RULES.standup.zipper : BAG_MAKE_RULES.standup.noZipper;
      return rate * cmToM(widthCm);
    }
    if (bagType === "三边封袋") {
      const shortSideM = Math.min(cmToM(widthCm), cmToM(heightCm));
      return BAG_MAKE_RULES.threeSide[rows] * shortSideM;
    }
    if (bagType === "中封袋" || bagType === "风琴袋") {
      return BAG_MAKE_RULES.centerAndGussetPerMeterHeight * cmToM(heightCm);
    }
    if (bagType === "八边封袋") {
      let rate = BAG_MAKE_RULES.eightSide.noZipper;
      if (zipper === "是") rate = BAG_MAKE_RULES.eightSide.zipperNormal;
      if (zipper === "易撕拉链") rate = BAG_MAKE_RULES.eightSide.zipperEasyTear;
      return rate * cmToM(widthCm);
    }
    return 0;
  }, [bagType, widthCm, heightCm, rows, zipper]);

  const extraProcessPerBag = useMemo(() => {
    let sum = 0;
    if (foilRow !== "无" && foilAreaCm2 > 0) {
      const areaM2Local = cm2ToM2(foilAreaCm2);
      let perTime = EXTRA.foilPerTimeSingleRow;
      if (foilRow === "双排") perTime += EXTRA.foilPerTimeDoubleRowAdd;
      sum += areaM2Local * EXTRA.foilAreaPricePerM2 + perTime;
    }
    sum += valveCount * EXTRA.valvePerUnit;
    sum += handleCount * EXTRA.handlePerUnit;
    sum += laborPerBag;
    return sum;
  }, [foilRow, foilAreaCm2, valveCount, handleCount, laborPerBag]);

  const { setupPerBag, platePerBag } = useMemo(() => {
    const coverageToColors: Record<PrintCoverage, number> = {
      "25": 2, "50": 2, "100": 3, "150": 4, "200": 5, "300": 6,
    };
    const colors = Math.min(coverageToColors[coverage] ?? 3, SETUP.maxColors);
    const setup = (colors * SETUP.perColor) / Math.max(quantity, 1);
    const filmWidthMmGuess = Math.min((cmToM(widthCm) * 1000) * 1.5, SETUP.filmWidthMaxMm);
    const plateLenMm = filmWidthMmGuess <= 800 ? 860 : 1100;
    const plateLenCm = plateLenMm / 10;
    const plateRoundCm = 40;
    const plateFeeTotal = plateLenCm * plateRoundCm * SETUP.platePerCm2;
    const plate = plateFeeTotal / Math.max(quantity, 1);
    return { setupPerBag: setup, platePerBag: plate };
  }, [coverage, quantity, widthCm]);

  const discount = useMemo(() => moqDiscount(quantity), [quantity]);

  /** ============ 汇总 ============ */
  const singleBagRMB = (
    materialCostPerBag + printCostPerBag + lamCostPerBag + 
    bagMakeCostPerBag + extraProcessPerBag + setupPerBag + platePerBag
  ) * discount;

  const totalRMB = singleBagRMB * (quantity || 0);

  /** ============ 便捷展示数值 ============ */

  /** ============ 多层操作 ============ */
  const addLayer = () => {
    const id = (layers.at(-1)?.id ?? 0) + 1;
    setLayers([...layers, { id, materialName: "PET-12μm" }]);
  };

  const removeLayer = (id: number) => {
    if (layers.length <= 1) return;
    setLayers(layers.filter((l) => l.id !== id));
  };

  const updateLayer = (id: number, materialName: string) => {
    setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, materialName } : l)));
  };

  /** ============ 需要显示的额外尺寸输入 ============ */
  const showBottomInsert = bagType === "站立袋" || bagType === "八边封袋";
  const showBackSeam = bagType === "中封袋" || bagType === "风琴袋";
  const showSideGusset = bagType === "风琴袋" || bagType === "八边封袋";
  const showRows = bagType === "三边封袋";

  /** ============ 渲染 ============ */
  return (
    <div className="app">
      <h1>📦 包装袋自动报价系统</h1>

      <div className="vertical-layout">
        {/* 上半部分：输入参数 */}
        <div className="input-section">
          <h2>输入参数</h2>

          {/* 基础参数 */}
          <div className="section">
            <h3>基础参数</h3>
            <div className="grid-six">
              <div className="input-group">
                <label>袋型：</label>
                <select value={bagType} onChange={(e) => setBagType(e.target.value as BagType)}>
                  <option value="站立袋">站立袋</option>
                  <option value="三边封袋">三边封袋</option>
                  <option value="中封袋">中封袋</option>
                  <option value="风琴袋">风琴袋</option>
                  <option value="八边封袋">八边封袋</option>
                </select>
              </div>

              <div className="input-group">
                <label>单位：</label>
                <select value={unit} onChange={(e) => setUnit(e.target.value as Unit)}>
                  <option value="cm">cm</option>
                  <option value="inch">inch</option>
                </select>
              </div>

              <div className="input-group">
                <label>宽度 ({unit})：</label>
                <input
                  type="number"
                  value={width || ""}
                  onChange={(e) => setWidth(parseFloat(e.target.value) || 0)}
                />
                <div className="hint">{widthCm.toFixed(2)} cm</div>
              </div>

              <div className="input-group">
                <label>高度 ({unit})：</label>
                <input
                  type="number"
                  value={height || ""}
                  onChange={(e) => setHeight(parseFloat(e.target.value) || 0)}
                />
                <div className="hint">{heightCm.toFixed(2)} cm</div>
              </div>

              {showBottomInsert && (
                <div className="input-group">
                  <label>底插入 ({unit})：</label>
                  <input
                    type="number"
                    value={bottomInsert || ""}
                    onChange={(e) => setBottomInsert(parseFloat(e.target.value) || 0)}
                  />
                </div>
              )}

              {showBackSeam && (
                <div className="input-group">
                  <label>背封边 ({unit})：</label>
                  <input
                    type="number"
                    value={backSeam || ""}
                    onChange={(e) => setBackSeam(parseFloat(e.target.value) || 0)}
                  />
                </div>
              )}

              {showSideGusset && (
                <div className="input-group">
                  <label>侧面展开 ({unit})：</label>
                  <input
                    type="number"
                    value={sideGusset || ""}
                    onChange={(e) => setSideGusset(parseFloat(e.target.value) || 0)}
                  />
                </div>
              )}

              {showRows && (
                <div className="input-group">
                  <label>排数：</label>
                  <select value={rows} onChange={(e) => setRows(e.target.value as "单排" | "双排" | "三排")}>
                    <option value="单排">单排</option>
                    <option value="双排">双排</option>
                    <option value="三排">三排</option>
                  </select>
                </div>
              )}

              <div className="input-group">
                <label>订单数量：</label>
                <input
                  type="number"
                  value={quantity || ""}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                />
              </div>
            </div>
          </div>

          {/* 材料层 */}
          <div className="section">
            <h3>材料层</h3>
            <div className="layers-grid">
              {layers.map((layer) => (
                <div key={layer.id} className="layer-item">
                  <div className="layer-label">第{layer.id}层：</div>
                  <select
                    value={layer.materialName}
                    onChange={(e) => updateLayer(layer.id, e.target.value)}
                  >
                    {MATERIAL_OPTIONS.map((m) => (
                      <option key={m.name} value={m.name}>{m.name}</option>
                    ))}
                  </select>
                  {layers.length > 1 && (
                    <button className="remove-btn" onClick={() => removeLayer(layer.id)}>×</button>
                  )}
                </div>
              ))}
              {layers.length < 4 && (
                <button className="add-layer-btn" onClick={addLayer}>+ 添加层</button>
              )}
            </div>
          </div>

          {/* 工艺选项 */}
          <div className="section">
            <h3>工艺选项</h3>
            <div className="grid-six">
              <div className="input-group">
                <label>印刷覆盖率：</label>
                <select value={coverage} onChange={(e) => setCoverage(e.target.value as PrintCoverage)}>
                  <option value="25">25%</option>
                  <option value="50">50%</option>
                  <option value="100">100%</option>
                  <option value="150">150%</option>
                  <option value="200">200%（镀铝）</option>
                  <option value="300">300%（哑油）</option>
                </select>
              </div>

              <div className="input-group">
                <label>复合方式：</label>
                <select value={lamination} onChange={(e) => setLamination(e.target.value as Lamination)}>
                  <option value="干复">干复</option>
                  <option value="干复蒸煮">干复蒸煮</option>
                  <option value="无溶剂">无溶剂</option>
                </select>
              </div>

              <div className="input-group">
                <label>拉链：</label>
                <select value={zipper} onChange={(e) => setZipper(e.target.value as "否" | "是" | "易撕拉链")}>
                  <option value="否">无</option>
                  <option value="是">普通拉链</option>
                  <option value="易撕拉链">易撕拉链</option>
                </select>
              </div>

              <div className="input-group">
                <label>烫金：</label>
                <select value={foilRow} onChange={(e) => setFoilRow(e.target.value as "无" | "单排" | "双排")}>
                  <option value="无">无</option>
                  <option value="单排">单排</option>
                  <option value="双排">双排</option>
                </select>
              </div>

              <div className="input-group">
                <label>烫金面积 (cm²)：</label>
                <input
                  type="number"
                  value={foilAreaCm2 || ""}
                  onChange={(e) => setFoilAreaCm2(parseFloat(e.target.value) || 0)}
                />
              </div>

              <div className="input-group">
                <label>透气阀（个）：</label>
                <input
                  type="number"
                  value={valveCount || ""}
                  onChange={(e) => setValveCount(parseInt(e.target.value) || 0)}
                />
              </div>

              <div className="input-group">
                <label>手提（个）：</label>
                <input
                  type="number"
                  value={handleCount || ""}
                  onChange={(e) => setHandleCount(parseInt(e.target.value) || 0)}
                />
              </div>

              <div className="input-group">
                <label>美元汇率：</label>
                <input
                  type="number"
                  step="0.01"
                  value={fxRate}
                  onChange={(e) => setFxRate(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* 下半部分：报价结果 */}
        <div className="result-section">
          <h2>报价结果</h2>

          {/* 总价 & 单袋 */}
          <div className="highlight">
            <div className="price-row">
              <div className="price-item">
                <div className="price-label">总价：</div>
                <div className="price-value">
                  {moneyRMB(totalRMB)} / {moneyUSD(totalRMB, fxRate)}
                </div>
              </div>
              <div className="price-item">
                <div className="price-label">单袋成本：</div>
                <div className="price-value">
                  {moneyRMB(singleBagRMB)} / {moneyUSD(singleBagRMB, fxRate)}
                </div>
              </div>
            </div>
          </div>

          {/* 明细 */}
          <div className="detail-grid">
            <div className="detail-item">
              <span>面积：</span>
              <span>{areaM2.toFixed(4)} m²</span>
            </div>
            <div className="detail-item">
              <span>材料成本：</span>
              <span>{moneyRMB(materialCostPerBag)}</span>
            </div>
            <div className="detail-item">
              <span>印刷成本：</span>
              <span>{moneyRMB(printCostPerBag)}</span>
            </div>
            <div className="detail-item">
              <span>复合成本：</span>
              <span>{moneyRMB(lamCostPerBag)}</span>
            </div>
            <div className="detail-item">
              <span>制袋成本：</span>
              <span>{moneyRMB(bagMakeCostPerBag)}</span>
            </div>
            <div className="detail-item">
              <span>附加工艺：</span>
              <span>{moneyRMB(extraProcessPerBag)}</span>
            </div>
            <div className="detail-item">
              <span>上机费：</span>
              <span>{moneyRMB(setupPerBag)}</span>
            </div>
            <div className="detail-item">
              <span>版费：</span>
              <span>{moneyRMB(platePerBag)}</span>
            </div>
            <div className="detail-item">
              <span>折扣系数：</span>
              <span>{discount.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
      </div>
  );
}