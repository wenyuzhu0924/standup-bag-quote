import { useEffect, useMemo, useState } from "react";
import "./App.css";

/** ========= 常量与类型 ========= */
type Unit = "mm" | "inch";
type BagType = "站立袋" | "三边封袋" | "中封袋" | "风琴袋" | "八边封袋";
type MaterialKind = "plastic" | "paper" | "custom";
type Lamination = "干复" | "干复蒸煮" | "无溶剂";
type PrintCoverage = "25" | "50" | "100" | "150" | "200" | "300";
type PrintMethod = "凹印" | "柔印";

const PRINT_PRICES: Record<PrintCoverage, number> = {
  "25": 0.11, "50": 0.13, "100": 0.16, "150": 0.21, "200": 0.26, "300": 0.36,
};
const LAM_PRICES: Record<Lamination, number> = {
  "干复": 0.13, "干复蒸煮": 0.18, "无溶剂": 0.065,
};
// 制袋单价（元/米 或 元/袋的规则项）
const BAG_RULES = {
  standup: { noZipper: 0.09, zipper: 0.19 },                // 元/米 × 带宽（袋宽m）
  threeSide: { 单排: 0.045, 双排: 0.03, 三排: 0.0225 },     // 元/米 × 短边（m）
  centerAndGussetPerMeterHeight: 0.04,                       // 中封/风琴：元/米 × 袋高（m）
  eightSide: { noZipper: 0.28, zipperNormal: 0.5, zipperEasyTear: 0.75 }, // 元/米 × 带宽（袋宽m）
};
// 附加工艺 & 人工
const EXTRA = { foilAreaPricePerM2: 1.2, valvePerUnit: 0.11, handlePerUnit: 0.15 };
const LABOR = { thresholdMm: 140, small: 0.024, large: 0.026 };
// 上机/版费
const SETUP = { perColor: 200, maxTotal: 1800 };
const PLATE = { perCm2: 0.11 };

function moqDiscount(qty: number) {
  if (qty >= 100000) return 0.96;
  if (qty >= 50000) return 0.98;
  if (qty >= 30000) return 1.0;
  if (qty >= 20000) return 1.15;
  if (qty >= 10000) return 1.3;
  return 1.4;
}

const inchToMm = (inch: number) => inch * 25.4;
const mm2ToM2 = (mm2: number) => mm2 / 1_000_000;
const mmToM = (mm: number) => mm / 1000;

function moneyRMB(v: number) { return isFinite(v) ? `¥${v.toFixed(4)}` : "¥0.0000"; }
function moneyRMB2(v: number) { return isFinite(v) ? `¥${v.toFixed(2)}` : "¥0.00"; }
function moneyUSD(v: number, rate: number) { return isFinite(v) && rate > 0 ? `$${(v / rate).toFixed(2)}` : "$0.00"; }

/** ========= 材料库（保留原有选项） ========= */
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

  // CPP系列（允许任意厚度覆盖）
  { name: "CPP-25μm", type: "plastic", density: 0.91, thickness: 25, pricePerKg: 9 },
  { name: "CPP-30μm", type: "plastic", density: 0.91, thickness: 30, pricePerKg: 9.2 },
  { name: "CPP-40μm", type: "plastic", density: 0.91, thickness: 40, pricePerKg: 9.5 },
  { name: "VMCPP-25μm", type: "plastic", density: 0.91, thickness: 25, pricePerKg: 11 },
  { name: "VMCPP-30μm", type: "plastic", density: 0.91, thickness: 30, pricePerKg: 11.2 },

  // PE系列（允许任意厚度覆盖）
  { name: "PE-30μm", type: "plastic", density: 0.92, thickness: 30, pricePerKg: 9.2 },
  { name: "PE-40μm", type: "plastic", density: 0.92, thickness: 40, pricePerKg: 9.5 },
  { name: "PE-50μm", type: "plastic", density: 0.92, thickness: 50, pricePerKg: 9.8 },
  { name: "PE-90μm", type: "plastic", density: 0.92, thickness: 90, pricePerKg: 10.16 },

  // BOPA系列
  { name: "BOPA-15μm", type: "plastic", density: 1.16, thickness: 15, pricePerKg: 17 },
  { name: "BOPA-20μm", type: "plastic", density: 1.16, thickness: 20, pricePerKg: 17.5 },

  // 纸类（克重计）
  { name: "牛皮纸-60g", type: "paper", grammage: 60, pricePerKg: 7 },
  { name: "牛皮纸-80g", type: "paper", grammage: 80, pricePerKg: 7.2 },
  { name: "白牛皮纸-60g", type: "paper", grammage: 60, pricePerKg: 8 },
  { name: "白牛皮纸-80g", type: "paper", grammage: 80, pricePerKg: 8.2 },
  { name: "棉纸-19g", type: "paper", grammage: 19, pricePerKg: 11 },
] as const;

/** ========= 类型 ========= */
interface Layer {
  id: number;
  materialKey: string;               // 选项名 或 "custom"
  // 自定义材料字段
  customName?: string;
  customThicknessUm?: number;
  customDensity?: number;
  customPricePerKg?: number;
  // CPP / PE 厚度覆盖
  overrideThicknessUm?: number;
}
interface LaminationBetweenLayers {
  id: number;                        // 第 id 层 与 第 id+1 层之间
  method: Lamination;
}
interface PrintPlate {
  id: number;
  coverage: PrintCoverage;           // 25~300
}

/** ========= 主组件 ========= */
export default function App() {
  /** —— 袋型与尺寸 —— */
  const [bagType, setBagType] = useState<BagType>("站立袋");
  const [unit, setUnit] = useState<Unit>("mm");

  // 通用（站立/三边封均用到）
  const [width, setWidth] = useState<number>(190);
  const [height, setHeight] = useState<number>(300);

  // 站立/八边封用：底插入
  const [bottomInsert, setBottomInsert] = useState<number>(40);

  // 中封/风琴用：背封边
  const [backSeam, setBackSeam] = useState<number>(10); // mm，默认 10mm = 1cm

  // 风琴/八边封用：侧面展开
  const [sideGusset, setSideGusset] = useState<number>(0);

  // 三边封用：排数
  const [rows, setRows] = useState<"单排" | "双排" | "三排">("单排");

  // 数量与拉链/汇率
  const [hasZipper, setHasZipper] = useState<"无" | "有" | "易撕拉链">("有");
  const [quantity, setQuantity] = useState<number>(30000);
  const [fxRate, setFxRate] = useState<number>(7.2);

  /** —— 材料层（默认 12PET/12VMPET/90PE） —— */
  const [layers, setLayers] = useState<Layer[]>([
    { id: 1, materialKey: "PET-12μm" },
    { id: 2, materialKey: "VMPET-12μm" },
    { id: 3, materialKey: "PE-90μm" },
  ]);

  /** —— 复合：层数n ⇒ n-1 条 —— */
  const [laminations, setLaminations] = useState<LaminationBetweenLayers[]>([
    { id: 1, method: "干复" },
    { id: 2, method: "无溶剂" },
  ]);

  /** —— 印刷（次数=层数） —— */
  const [printMethod, setPrintMethod] = useState<PrintMethod>("凹印");
  const [printPlates, setPrintPlates] = useState<PrintPlate[]>([
    { id: 1, coverage: "100" },
    { id: 2, coverage: "100" },
    { id: 3, coverage: "300" },
  ]);
  // 版长/周（cm）
  const [plateLengthCm, setPlateLengthCm] = useState<number>(86);
  const [plateRoundCm, setPlateRoundCm] = useState<number>(19);

  /** —— 附加工艺 —— */
  const [foilAreaMm2, setFoilAreaMm2] = useState<number>(0);
  const [valveCount, setValveCount] = useState<number>(0);
  const [handleCount, setHandleCount] = useState<number>(0);

  /** —— 同步：印刷次数=层数 —— */
  useEffect(() => {
    if (printPlates.length === layers.length) return;
    let next = [...printPlates];
    if (printPlates.length < layers.length) {
      for (let i = printPlates.length; i < layers.length; i++) next.push({ id: i + 1, coverage: "100" });
    } else {
      next = next.slice(0, layers.length).map((p, i) => ({ ...p, id: i + 1 }));
    }
    setPrintPlates(next);
  }, [layers.length]); // eslint-disable-line

  /** —— 同步：复合条目=层数-1 —— */
  useEffect(() => {
    const need = Math.max(layers.length - 1, 0);
    if (laminations.length === need) return;
    let next = [...laminations];
    if (laminations.length < need) {
      for (let i = laminations.length; i < need; i++) next.push({ id: i + 1, method: "干复" });
    } else {
      next = next.slice(0, need).map((l, i) => ({ ...l, id: i + 1 }));
    }
    setLaminations(next);
  }, [layers.length]); // eslint-disable-line

  /** —— 单位换算 —— */
  const widthMm  = unit === "inch" ? inchToMm(width) : width;
  const heightMm = unit === "inch" ? inchToMm(height) : height;
  const bottomInsertMm = unit === "inch" ? inchToMm(bottomInsert) : bottomInsert;
  const backSeamMm = unit === "inch" ? inchToMm(backSeam) : backSeam;
  const sideGussetMm = unit === "inch" ? inchToMm(sideGusset) : sideGusset;

  /** —— 展开面积（按袋型） —— */
  const areaMm2 = useMemo(() => {
    switch (bagType) {
      case "站立袋":
        // 宽 × (高 + 底插入) × 2
        return widthMm * (heightMm + bottomInsertMm) * 2;
      case "三边封袋":
        // 宽 × 高 × 2
        return widthMm * heightMm * 2;
      case "中封袋":
        // (宽 + 2 × 背封边 × 2) × 高   —— 题述写法等价：(宽 × 2 + 背封边 × 2) × 高
        return (widthMm * 2 + backSeamMm * 2) * heightMm;
      case "风琴袋":
        // (宽 + 2 × 背封边 × 2 + 2 × 侧面展开 × 2) × 高 —— 等价：(宽×2 + 背封边×2 + 侧面展开×2) × 高
        return (widthMm * 2 + backSeamMm * 2 + sideGussetMm * 2) * heightMm;
      case "八边封袋":
        // (正面高 + 背面高 + 底部 + 3cm) × (宽 + 0.6) + (侧面展开 + 0.6) × 2 × (成品高度 + 1)
        // 用成品高=heightMm，底部=bottomInsertMm；常量：3cm=30mm，0.6cm=6mm，1cm=10mm
        return (heightMm + heightMm + bottomInsertMm + 30) * (widthMm + 6) + (sideGussetMm + 6) * 2 * (heightMm + 10);
      default:
        return widthMm * heightMm * 2;
    }
  }, [bagType, widthMm, heightMm, bottomInsertMm, backSeamMm, sideGussetMm]);

  const areaM2 = mm2ToM2(areaMm2);

  /** —— 人工 —— */
  const laborPerBag = widthMm <= LABOR.thresholdMm ? LABOR.small : LABOR.large;

  /** —— 材料参数解析 —— */
  function getLayerParams(layer: Layer) {
    if (layer.materialKey === "custom") {
      return {
        name: layer.customName?.trim() || "自定义材料",
        type: "custom" as MaterialKind,
        thicknessUm: layer.customThicknessUm || 0,
        density: layer.customDensity || 0,
        pricePerKg: layer.customPricePerKg || 0,
        grammage: undefined as number | undefined,
      };
    }
    const def = MATERIAL_OPTIONS.find(m => m.name === layer.materialKey) as any;
    if (!def) {
      return {
        name: layer.materialKey,
        type: "custom" as MaterialKind,
        thicknessUm: layer.customThicknessUm || 0,
        density: layer.customDensity || 0,
        pricePerKg: layer.customPricePerKg || 0,
        grammage: undefined,
      };
    }
    if (def.type === "paper") {
      return {
        name: def.name,
        type: "paper" as MaterialKind,
        grammage: def.grammage as number,      // g/m²
        pricePerKg: def.pricePerKg as number,
        thicknessUm: undefined,
        density: undefined,
      };
    }
    // plastic：CPP/PE 支持厚度覆盖
    let thicknessUm = def.thickness as number;
    const isCPPorPE = def.name.startsWith("CPP") || def.name.startsWith("PE");
    if (isCPPorPE && layer.overrideThicknessUm && layer.overrideThicknessUm > 0) thicknessUm = layer.overrideThicknessUm;
    return {
      name: def.name,
      type: "plastic" as MaterialKind,
      thicknessUm,
      density: def.density as number,         // g/cm³
      pricePerKg: def.pricePerKg as number,   // 元/kg
      grammage: undefined,
    };
  }

  /** —— 材料成本 —— */
  const materialCostPerBag = useMemo(() => {
    let sum = 0;
    layers.forEach(layer => {
      const p = getLayerParams(layer);
      if (p.type === "paper") {
        const weightKg = areaM2 * (p.grammage || 0) / 1000;         // g → kg
        sum += weightKg * (p.pricePerKg || 0);
      } else {
        const thicknessM = (p.thicknessUm || 0) * 1e-6;
        const densityKgM3 = (p.density || 0) * 1000;
        const weightKg = areaM2 * thicknessM * densityKgM3;
        sum += weightKg * (p.pricePerKg || 0);
      }
    });
    return sum;
  }, [layers, areaM2]);

  /** —— 印刷成本（次数=层数） —— */
  const printCostPerBag = useMemo(() => {
    return printPlates.reduce((acc, p) => acc + areaM2 * PRINT_PRICES[p.coverage], 0);
  }, [printPlates, areaM2]);

  /** —— 复合成本（逐间隙） —— */
  const lamCostPerBag = useMemo(() => {
    return laminations.reduce((acc, l) => acc + areaM2 * LAM_PRICES[l.method], 0);
  }, [laminations, areaM2]);

  /** —— 制袋成本（按袋型） —— */
  const bagMakePerBag = useMemo(() => {
    if (bagType === "站立袋") {
      const rate = hasZipper === "有" ? BAG_RULES.standup.zipper : BAG_RULES.standup.noZipper;
      return rate * mmToM(widthMm);
    }
    if (bagType === "三边封袋") {
      const shortSideM = Math.min(mmToM(widthMm), mmToM(heightMm));
      return BAG_RULES.threeSide[rows] * shortSideM;
    }
    if (bagType === "中封袋" || bagType === "风琴袋") {
      return BAG_RULES.centerAndGussetPerMeterHeight * mmToM(heightMm);
    }
    if (bagType === "八边封袋") {
      let rate = BAG_RULES.eightSide.noZipper;
      if (hasZipper === "有") rate = BAG_RULES.eightSide.zipperNormal;
      if (hasZipper === "易撕拉链") rate = BAG_RULES.eightSide.zipperEasyTear;
      return rate * mmToM(widthMm);
    }
    return 0;
  }, [bagType, widthMm, heightMm, rows, hasZipper]);

  /** —— 附加工艺 —— */
  const extraProcessPerBag = useMemo(() => {
    let sum = 0;
    if (foilAreaMm2 > 0) sum += mm2ToM2(foilAreaMm2) * EXTRA.foilAreaPricePerM2;
    sum += valveCount * EXTRA.valvePerUnit;
    sum += handleCount * EXTRA.handlePerUnit;
    sum += laborPerBag;
    return sum;
  }, [foilAreaMm2, valveCount, handleCount, laborPerBag]);

  /** —— 上机/版费（按整单计，折算到每袋） —— */
  const colors = printPlates.length;
  const setupTotalRMB = Math.min(colors * SETUP.perColor, SETUP.maxTotal);
  const setupPerBag = setupTotalRMB / Math.max(quantity || 0, 1);
  const plateTotalRMB = (plateLengthCm * plateRoundCm * colors * PLATE.perCm2);
  const platePerBag = plateTotalRMB / Math.max(quantity || 0, 1);

  /** —— 折扣、总价 —— */
  const discount = moqDiscount(quantity);
  const singleBagRMB_raw =
    materialCostPerBag + printCostPerBag + lamCostPerBag +
    bagMakePerBag + extraProcessPerBag + setupPerBag + platePerBag;
  const singleBagRMB = singleBagRMB_raw * discount;
  const totalRMB = singleBagRMB * (quantity || 0);

  /** —— 交互：层/复合/印刷 —— */
  const addLayer = () => {
    if (layers.length >= 4) return;
    const id = (layers.at(-1)?.id ?? 0) + 1;
    setLayers(prev => [...prev, { id, materialKey: "PET-12μm" }]);
  };
  const removeLayer = (id: number) => {
    if (layers.length <= 1) return;
    const newLayers = layers.filter(l => l.id !== id).map((l, i) => ({ ...l, id: i + 1 }));
    setLayers(newLayers);
  };
  const updateLayerKey = (id: number, key: string) => {
    setLayers(prev => prev.map(l => (l.id === id ? { ...l, materialKey: key } : l)));
  };
  const updateLayerOverrideThickness = (id: number, val: number) => {
    setLayers(prev => prev.map(l => (l.id === id ? { ...l, overrideThicknessUm: val } : l)));
  };
  const updateLayerCustom = (id: number, field: "customName" | "customThicknessUm" | "customDensity" | "customPricePerKg", value: string | number) => {
    setLayers(prev => prev.map(l => (l.id === id ? { ...l, [field]: value } : l)));
  };
  const updateLamination = (idx: number, method: Lamination) => {
    setLaminations(prev => {
      const copy = [...prev];
      copy[idx] = { id: idx + 1, method };
      return copy;
    });
  };
  const updatePlateCoverage = (id: number, cov: PrintCoverage) => {
    setPrintPlates(prev => prev.map(p => (p.id === id ? { ...p, coverage: cov } : p)));
  };

  /** —— UI条件输入显示 —— */
  const showBottomInsert = bagType === "站立袋" || bagType === "八边封袋";
  const showBackSeam = bagType === "中封袋" || bagType === "风琴袋";
  const showSideGusset = bagType === "风琴袋" || bagType === "八边封袋";
  const showRows = bagType === "三边封袋";

  /** ========= 渲染 ========= */
  return (
    <div style={{ padding: 16, maxWidth: 1200, margin: "0 auto" }}>
      <h1>📦 包装袋自动报价系统</h1>

      {/* 上：输入区 */}
      <div className="section" style={{ border: "1px solid #eee", padding: 16, borderRadius: 12, marginBottom: 16 }}>
        <h2>基础参数</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12 }}>
          <div className="input-group">
            <label>袋型</label>
            <select value={bagType} onChange={(e) => setBagType(e.target.value as BagType)}>
              <option value="站立袋">站立袋</option>
              <option value="三边封袋">三边封袋</option>
              <option value="中封袋">中封袋</option>
              <option value="风琴袋">风琴袋</option>
              <option value="八边封袋">八边封袋</option>
            </select>
          </div>
          <div className="input-group">
            <label>单位</label>
            <select value={unit} onChange={(e) => setUnit(e.target.value as Unit)}>
              <option value="mm">mm</option>
              <option value="inch">inch</option>
            </select>
          </div>
          <div className="input-group">
            <label>宽度（{unit}）</label>
            <input type="number" value={width || ""} onChange={(e) => setWidth(parseFloat(e.target.value) || 0)} />
            <div className="hint">{widthMm.toFixed(2)} mm</div>
          </div>
          <div className="input-group">
            <label>高度（{unit}）</label>
            <input type="number" value={height || ""} onChange={(e) => setHeight(parseFloat(e.target.value) || 0)} />
            <div className="hint">{heightMm.toFixed(2)} mm</div>
          </div>

          {showBottomInsert && (
            <div className="input-group">
              <label>底插入（{unit}）</label>
              <input type="number" value={bottomInsert || ""} onChange={(e) => setBottomInsert(parseFloat(e.target.value) || 0)} />
              <div className="hint">{bottomInsertMm.toFixed(2)} mm</div>
            </div>
          )}
          {showBackSeam && (
            <div className="input-group">
              <label>背封边（{unit}）</label>
              <input type="number" value={backSeam || ""} onChange={(e) => setBackSeam(parseFloat(e.target.value) || 0)} />
              <div className="hint">{backSeamMm.toFixed(2)} mm</div>
            </div>
          )}
          {showSideGusset && (
            <div className="input-group">
              <label>侧面展开（{unit}）</label>
              <input type="number" value={sideGusset || ""} onChange={(e) => setSideGusset(parseFloat(e.target.value) || 0)} />
              <div className="hint">{sideGussetMm.toFixed(2)} mm</div>
            </div>
          )}
          {showRows && (
            <div className="input-group">
              <label>排数</label>
              <select value={rows} onChange={(e) => setRows(e.target.value as "单排" | "双排" | "三排")}>
                <option value="单排">单排</option>
                <option value="双排">双排</option>
                <option value="三排">三排</option>
              </select>
            </div>
          )}

          <div className="input-group">
            <label>拉链</label>
            <select value={hasZipper} onChange={(e) => setHasZipper(e.target.value as "无" | "有" | "易撕拉链")}>
              <option value="无">无</option>
              <option value="有">普通拉链</option>
              <option value="易撕拉链">易撕拉链（仅八边封）</option>
            </select>
          </div>
          <div className="input-group">
            <label>数量（个）</label>
            <input type="number" value={quantity || ""} onChange={(e) => setQuantity(parseInt(e.target.value) || 0)} />
          </div>
          <div className="input-group">
            <label>美元汇率</label>
            <input type="number" step="0.01" value={fxRate} onChange={(e) => setFxRate(parseFloat(e.target.value) || 0)} />
            <div className="hint">默认 7.2</div>
          </div>
        </div>

        <div style={{ marginTop: 8, color: "#666" }}>
          展开面积（{bagType}）= {
            bagType === "站立袋" && `宽 × (高 + 底插入) × 2 = ${widthMm.toFixed(0)} × (${heightMm.toFixed(0)} + ${bottomInsertMm.toFixed(0)}) × 2`
          }
          {bagType === "三边封袋" && `宽 × 高 × 2 = ${widthMm.toFixed(0)} × ${heightMm.toFixed(0)} × 2`}
          {bagType === "中封袋" && `(宽×2 + 背封边×2) × 高 = (${widthMm.toFixed(0)}×2 + ${backSeamMm.toFixed(0)}×2) × ${heightMm.toFixed(0)}`}
          {bagType === "风琴袋" && `(宽×2 + 背封边×2 + 侧面展开×2) × 高 = (${widthMm.toFixed(0)}×2 + ${backSeamMm.toFixed(0)}×2 + ${sideGussetMm.toFixed(0)}×2) × ${heightMm.toFixed(0)}`}
          {bagType === "八边封袋" && ` (正面高+背面高+底部+30)×(宽+6) + (侧面展开+6)×2×(成品高+10) = (${heightMm.toFixed(0)}+${heightMm.toFixed(0)}+${bottomInsertMm.toFixed(0)}+30)×(${widthMm.toFixed(0)}+6) + (${sideGussetMm.toFixed(0)}+6)×2×(${heightMm.toFixed(0)}+10)`}
          ，= {areaMm2.toFixed(0)} mm² = {areaM2.toFixed(4)} m²
        </div>
      </div>

      {/* 材料层 + 复合 */}
      <div className="section" style={{ border: "1px solid #eee", padding: 16, borderRadius: 12, marginBottom: 16 }}>
        <h2>材料层（1~4层） & 逐层复合</h2>
        {layers.map((layer, idx) => {
          const showCustom = layer.materialKey === "custom";
          const showOverride = !showCustom && (layer.materialKey.startsWith("CPP") || layer.materialKey.startsWith("PE"));
          return (
            <div key={layer.id} style={{ border: "1px dashed #ddd", borderRadius: 10, padding: 12, marginBottom: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "240px 1fr 1fr 1fr 1fr 80px", gap: 12, alignItems: "center" }}>
                <div><b>第{layer.id}层材料</b></div>
                <div>
                  <select value={layer.materialKey} onChange={(e) => updateLayerKey(layer.id, e.target.value)}>
                    {MATERIAL_OPTIONS.map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
                    <option value="custom">自定义材料</option>
                  </select>
                </div>

                {showOverride ? (
                  <div>
                    <label style={{ display: "block", fontSize: 12, color: "#666" }}>厚度覆盖(μm)</label>
                    <input type="number" value={layer.overrideThicknessUm || ""} onChange={(e) => updateLayerOverrideThickness(layer.id, parseFloat(e.target.value) || 0)} />
                  </div>
                ) : <div />}

                {showCustom ? (
                  <>
                    <div>
                      <label style={{ display: "block", fontSize: 12, color: "#666" }}>自定义名称</label>
                      <input type="text" placeholder="如：NY-25μm" value={layer.customName || ""} onChange={(e) => updateLayerCustom(layer.id, "customName", e.target.value)} />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 12, color: "#666" }}>厚度(μm)</label>
                      <input type="number" value={layer.customThicknessUm || ""} onChange={(e) => updateLayerCustom(layer.id, "customThicknessUm", parseFloat(e.target.value) || 0)} />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 12, color: "#666" }}>密度(g/cm³)</label>
                      <input type="number" step="0.01" value={layer.customDensity || ""} onChange={(e) => updateLayerCustom(layer.id, "customDensity", parseFloat(e.target.value) || 0)} />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 12, color: "#666" }}>单价(元/kg)</label>
                      <input type="number" step="0.01" value={layer.customPricePerKg || ""} onChange={(e) => updateLayerCustom(layer.id, "customPricePerKg", parseFloat(e.target.value) || 0)} />
                    </div>
                  </>
                ) : (<><div /><div /><div /><div /></>)}

                <div style={{ textAlign: "right" }}>
                  {layers.length > 1 && <button onClick={() => removeLayer(layer.id)}>删除</button>}
                </div>
              </div>

              {/* 复合（本层→下一层） */}
              {idx < layers.length - 1 && (
                <div style={{ marginTop: 10, padding: 10, background: "#fafafa", borderRadius: 8 }}>
                  <label>复合方式（第{layer.id}层 → 第{layer.id + 1}层）：</label>{" "}
                  <select value={laminations[idx]?.method || "干复"} onChange={(e) => updateLamination(idx, e.target.value as Lamination)}>
                    <option value="干复">干复</option>
                    <option value="干复蒸煮">干复蒸煮</option>
                    <option value="无溶剂">无溶剂</option>
                  </select>
                </div>
              )}
            </div>
          );
        })}
        {layers.length < 4 && <button onClick={addLayer}>+ 添加材料层</button>}
        <div style={{ marginTop: 8, color: "#666" }}>复合次数：{Math.max(layers.length - 1, 0)} 次</div>
      </div>

      {/* 印刷（次数=层数） */}
      <div className="section" style={{ border: "1px solid #eee", padding: 16, borderRadius: 12, marginBottom: 16 }}>
        <h2>印刷设置（印刷次数 = 材料层数：{printPlates.length}）</h2>
        <div className="input-group" style={{ marginBottom: 8 }}>
          <label style={{ marginRight: 8 }}>印刷方式：</label>
          <select value={printMethod} onChange={(e) => setPrintMethod(e.target.value as PrintMethod)}>
            <option value="凹印">凹印</option>
            <option value="柔印">柔印</option>
          </select>
          <span style={{ marginLeft: 12, color: "#666" }}>覆盖率单价：25%~300%（200%用于镀铝、300%用于哑油满版）</span>
        </div>

        {printPlates.map(p => (
          <div key={p.id} style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 12, alignItems: "center", marginBottom: 8 }}>
            <div><b>第{p.id}次印刷</b></div>
            <div>
              <select value={p.coverage} onChange={(e) => updatePlateCoverage(p.id, e.target.value as PrintCoverage)}>
                <option value="25">25%</option>
                <option value="50">50%</option>
                <option value="100">100%（满版）</option>
                <option value="150">150%</option>
                <option value="200">200%（镀铝+白底）</option>
                <option value="300">300%（满版哑油）</option>
              </select>
              <span style={{ marginLeft: 10, color: "#666" }}>单价：{PRINT_PRICES[p.coverage]} 元/㎡</span>
            </div>
          </div>
        ))}

        <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          <div className="input-group">
            <label>版长（cm）</label>
            <input type="number" value={plateLengthCm} onChange={(e) => setPlateLengthCm(parseFloat(e.target.value) || 0)} />
          </div>
          <div className="input-group">
            <label>版周（cm）</label>
            <input type="number" value={plateRoundCm} onChange={(e) => setPlateRoundCm(parseFloat(e.target.value) || 0)} />
          </div>
          <div className="input-group" style={{ alignSelf: "end", color: "#666" }}>
            版费 = 版长 × 版周 × 色数 × 0.11
          </div>
          <div className="input-group" style={{ alignSelf: "end", color: "#666" }}>
            上机费 = 200 × 色数（封顶 1800）
          </div>
        </div>
      </div>

      {/* 附加工艺 */}
      <div className="section" style={{ border: "1px solid #eee", padding: 16, borderRadius: 12, marginBottom: 16 }}>
        <h2>附加工艺</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12 }}>
          <div className="input-group">
            <label>烫金面积（mm²）</label>
            <input type="number" value={foilAreaMm2 || ""} onChange={(e) => setFoilAreaMm2(parseFloat(e.target.value) || 0)} />
          </div>
          <div className="input-group">
            <label>透气阀（个）</label>
            <input type="number" value={valveCount || ""} onChange={(e) => setValveCount(parseInt(e.target.value) || 0)} />
          </div>
          <div className="input-group">
            <label>手提（个）</label>
            <input type="number" value={handleCount || ""} onChange={(e) => setHandleCount(parseInt(e.target.value) || 0)} />
          </div>
          <div className="input-group" style={{ alignSelf: "end", color: "#666" }}>
            人工：≤14cm {LABOR.small.toFixed(3)} / &gt;14cm {LABOR.large.toFixed(3)} 元/袋
          </div>
        </div>
      </div>

      {/* 下：报价结果 */}
      <div className="section" style={{ border: "1px solid #e6eef5", background: "#f8fafc", padding: 16, borderRadius: 12, marginBottom: 16 }}>
        <h2>报价结果</h2>
        <div className="highlight" style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 8 }}>
          <div>
            <div style={{ color: "#666" }}>单袋成本（含折扣）</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>
              {moneyRMB2(singleBagRMB)} / {moneyUSD(singleBagRMB, fxRate)}
            </div>
          </div>
          <div>
            <div style={{ color: "#666" }}>总价（含折扣）</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>
              {moneyRMB2(totalRMB)} / {moneyUSD(totalRMB, fxRate)}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, fontSize: 14 }}>
          <div>面积：{areaM2.toFixed(4)} m²</div>
          <div>材料：{moneyRMB(materialCostPerBag)}</div>
          <div>印刷：{moneyRMB(printCostPerBag)}</div>
          <div>复合：{moneyRMB(lamCostPerBag)}</div>
          <div>制袋：{moneyRMB(bagMakePerBag)}</div>
          <div>附加工艺：{moneyRMB(extraProcessPerBag)}</div>
          <div>上机费/袋：{moneyRMB(setupPerBag)}</div>
          <div>版费/袋：{moneyRMB(platePerBag)}</div>
          <div>折扣系数：{discount.toFixed(2)}</div>
          <div>印刷色数（=层数）：{colors}</div>
        </div>

        {/* 详细计算（默认折叠） */}
        <details style={{ marginTop: 12 }}>
          <summary style={{ cursor: "pointer" }}>📘 展开查看详细计算过程（按所选袋型展示公式 + 数字）</summary>
          <div style={{ paddingTop: 8, lineHeight: 1.6 }}>
            <p><b>1）展开面积（{bagType}）</b></p>
            {bagType === "站立袋" && (
              <p>宽 × (高 + 底插入) × 2 = {widthMm.toFixed(0)} × ({heightMm.toFixed(0)} + {bottomInsertMm.toFixed(0)}) × 2 = {areaMm2.toFixed(0)} mm² = {areaM2.toFixed(6)} m²</p>
            )}
            {bagType === "三边封袋" && (
              <p>宽 × 高 × 2 = {widthMm.toFixed(0)} × {heightMm.toFixed(0)} × 2 = {areaMm2.toFixed(0)} mm² = {areaM2.toFixed(6)} m²</p>
            )}
            {bagType === "中封袋" && (
              <p>(宽×2 + 背封边×2) × 高 = ({widthMm.toFixed(0)}×2 + {backSeamMm.toFixed(0)}×2) × {heightMm.toFixed(0)} = {areaMm2.toFixed(0)} mm² = {areaM2.toFixed(6)} m²</p>
            )}
            {bagType === "风琴袋" && (
              <p>(宽×2 + 背封边×2 + 侧面展开×2) × 高 = ({widthMm.toFixed(0)}×2 + {backSeamMm.toFixed(0)}×2 + {sideGussetMm.toFixed(0)}×2) × {heightMm.toFixed(0)} = {areaMm2.toFixed(0)} mm² = {areaM2.toFixed(6)} m²</p>
            )}
            {bagType === "八边封袋" && (
              <p>(正面高+背面高+底部+30)×(宽+6) + (侧面展开+6)×2×(成品高+10) = ({heightMm.toFixed(0)}+{heightMm.toFixed(0)}+{bottomInsertMm.toFixed(0)}+30)×({widthMm.toFixed(0)}+6) + ({sideGussetMm.toFixed(0)}+6)×2×({heightMm.toFixed(0)}+10) = {areaMm2.toFixed(0)} mm² = {areaM2.toFixed(6)} m²</p>
            )}

            <p><b>2）材料成本（逐层）</b></p>
            <ul>
              {layers.map((layer) => {
                const P = getLayerParams(layer);
                if (P.type === "paper") {
                  const weightKg = areaM2 * (P.grammage || 0) / 1000;
                  const cost = weightKg * (P.pricePerKg || 0);
                  return (
                    <li key={layer.id}>
                      第{layer.id}层【{P.name}，纸】：重量 = {areaM2.toFixed(6)} × {P.grammage} / 1000 = {weightKg.toFixed(6)} kg；成本 = {weightKg.toFixed(6)} × {P.pricePerKg} = {moneyRMB(cost)}
                    </li>
                  );
                } else {
                  const tUm = P.thicknessUm || 0, density = P.density || 0, price = P.pricePerKg || 0;
                  const thicknessM = tUm * 1e-6, densityKgM3 = density * 1000;
                  const weightKg = areaM2 * thicknessM * densityKgM3;
                  const cost = weightKg * price;
                  return (
                    <li key={layer.id}>
                      第{layer.id}层【{P.name}】：重量 = {areaM2.toFixed(6)} × ({tUm}×10⁻⁶) × ({density}×1000) = {weightKg.toFixed(6)} kg；成本 = {weightKg.toFixed(6)} × {price} = {moneyRMB(cost)}
                    </li>
                  );
                }
              })}
            </ul>
            <p>材料合计：{moneyRMB(materialCostPerBag)}</p>

            <p><b>3）印刷成本（次数=层数，共 {colors} 次）</b></p>
            <ul>
              {printPlates.map((p) => {
                const fee = areaM2 * PRINT_PRICES[p.coverage];
                return <li key={p.id}>第{p.id}次：{areaM2.toFixed(6)} × {PRINT_PRICES[p.coverage]}(元/㎡, 覆盖率{p.coverage}%) = {moneyRMB(fee)}</li>;
              })}
            </ul>
            <p>印刷合计：{moneyRMB(printCostPerBag)}</p>

            <p><b>4）复合成本（逐间隙）</b></p>
            <ul>
              {laminations.map(l => {
                const fee = areaM2 * LAM_PRICES[l.method];
                return <li key={l.id}>第{l.id}层 → 第{l.id + 1}层：{areaM2.toFixed(6)} × {LAM_PRICES[l.method]} = {moneyRMB(fee)}</li>;
              })}
            </ul>
            <p>复合合计：{moneyRMB(lamCostPerBag)}</p>

            <p><b>5）制袋成本（按袋型）</b></p>
            {bagType === "站立袋" && (
              <p>站立袋：{hasZipper === "有" ? "0.19" : "0.09"} × 袋宽(米) = {hasZipper === "有" ? "0.19" : "0.09"} × {mmToM(widthMm).toFixed(3)} = {moneyRMB(bagMakePerBag)}</p>
            )}
            {bagType === "三边封袋" && (
              <p>三边封：{rows} 单价 × 短边(米) = {BAG_RULES.threeSide[rows]} × {Math.min(mmToM(widthMm), mmToM(heightMm)).toFixed(3)} = {moneyRMB(bagMakePerBag)}</p>
            )}
            {(bagType === "中封袋" || bagType === "风琴袋") && (
              <p>{bagType}：0.04 × 袋高(米) = 0.04 × {mmToM(heightMm).toFixed(3)} = {moneyRMB(bagMakePerBag)}</p>
            )}
            {bagType === "八边封袋" && (
              <p>八边封：{hasZipper === "无" ? "0.28" : (hasZipper === "有" ? "0.50" : "0.75")} × 袋宽(米) = {hasZipper === "无" ? "0.28" : (hasZipper === "有" ? "0.50" : "0.75")} × {mmToM(widthMm).toFixed(3)} = {moneyRMB(bagMakePerBag)}</p>
            )}

            <p><b>6）附加工艺</b></p>
            <p>
              烫金：{moneyRMB(mm2ToM2(foilAreaMm2) * EXTRA.foilAreaPricePerM2)}；&nbsp;
              透气阀：{valveCount} × {EXTRA.valvePerUnit} = {moneyRMB(valveCount * EXTRA.valvePerUnit)}；&nbsp;
              手提：{handleCount} × {EXTRA.handlePerUnit} = {moneyRMB(handleCount * EXTRA.handlePerUnit)}；&nbsp;
              人工：≤14cm {LABOR.small.toFixed(3)} / &gt;14cm {LABOR.large.toFixed(3)} = {moneyRMB(laborPerBag)}
            </p>
            <p>附加工艺合计：{moneyRMB(extraProcessPerBag)}</p>

            <p><b>7）上机费与版费</b></p>
            <p>色数 = {colors}；上机费（总）= min({colors} × 200, 1800) = {setupTotalRMB} 元； 折合/袋 = {moneyRMB(setupPerBag)}</p>
            <p>版费（总）= {plateLengthCm} × {plateRoundCm} × {colors} × 0.11 = {plateTotalRMB.toFixed(2)} 元； 折合/袋 = {moneyRMB(platePerBag)}</p>

            <p><b>8）折扣 &amp; 汇总</b></p>
            <p>
              折扣系数 = {discount.toFixed(2)}；<br />
              单袋（含折扣）= {moneyRMB(singleBagRMB_raw)} × {discount.toFixed(2)} = <b>{moneyRMB(singleBagRMB)}</b>；<br />
              总价（含折扣）= {moneyRMB(singleBagRMB)} × {quantity} = <b>{moneyRMB2(totalRMB)}</b>（约 {moneyUSD(totalRMB, fxRate)}）
            </p>
          </div>
        </details>
      </div>
    </div>
  );
}
