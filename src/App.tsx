import { useMemo, useState } from "react";
import "./App.css";

/** ====== 基础数据（保留你的材料 + 自定义入口） ====== */
const MATERIAL_OPTIONS = [
  { name: "PET-12μm", type: "plastic", density: 1.4, thickness: 12, pricePerKg: 8 },
  { name: "PET-15μm", type: "plastic", density: 1.4, thickness: 15, pricePerKg: 8.2 },
  { name: "VMPET-12μm", type: "plastic", density: 1.4, thickness: 12, pricePerKg: 9 },
  { name: "VMPET-15μm", type: "plastic", density: 1.4, thickness: 15, pricePerKg: 9.2 },
  { name: "BOPP-20μm", type: "plastic", density: 0.91, thickness: 20, pricePerKg: 8.5 },
  { name: "BOPP-25μm", type: "plastic", density: 0.91, thickness: 25, pricePerKg: 8.8 },
  { name: "BOPP-30μm", type: "plastic", density: 0.91, thickness: 30, pricePerKg: 9.1 },
  { name: "CPP-25μm", type: "plastic", density: 0.91, thickness: 25, pricePerKg: 9 },
  { name: "CPP-30μm", type: "plastic", density: 0.91, thickness: 30, pricePerKg: 9.2 },
  { name: "CPP-40μm", type: "plastic", density: 0.91, thickness: 40, pricePerKg: 9.5 },
  { name: "VMCPP-25μm", type: "plastic", density: 0.91, thickness: 25, pricePerKg: 11 },
  { name: "VMCPP-30μm", type: "plastic", density: 0.91, thickness: 30, pricePerKg: 11.2 },
  { name: "PE-30μm", type: "plastic", density: 0.92, thickness: 30, pricePerKg: 9.2 },
  { name: "PE-40μm", type: "plastic", density: 0.92, thickness: 40, pricePerKg: 9.5 },
  { name: "PE-50μm", type: "plastic", density: 0.92, thickness: 50, pricePerKg: 9.8 },
  { name: "PE-90μm", type: "plastic", density: 0.92, thickness: 90, pricePerKg: 10.16 },
  { name: "BOPA-15μm", type: "plastic", density: 1.16, thickness: 15, pricePerKg: 17 },
  { name: "BOPA-20μm", type: "plastic", density: 1.16, thickness: 20, pricePerKg: 17.5 },
  { name: "牛皮纸-60g", type: "paper", grammage: 60, pricePerKg: 7 },
  { name: "牛皮纸-80g", type: "paper", grammage: 80, pricePerKg: 7.2 },
  { name: "白牛皮纸-60g", type: "paper", grammage: 60, pricePerKg: 8 },
  { name: "白牛皮纸-80g", type: "paper", grammage: 80, pricePerKg: 8.2 },
  { name: "棉纸-19g", type: "paper", grammage: 19, pricePerKg: 11 },
  { name: "自定义…", type: "custom" } as any
] as const;

type Unit = "mm" | "inch";
type BagType = "站立袋" | "三边封袋" | "中封袋" | "风琴袋" | "八边封袋";
type PrintCoverage = "25" | "50" | "100" | "150" | "200" | "300";

/** 覆盖率单价（元/m²） */
const PRINT_PRICE: Record<PrintCoverage, number> = {
  "25": 0.11, "50": 0.13, "100": 0.16, "150": 0.21, "200": 0.26, "300": 0.36,
};

/** 复合单价（元/m²） */
type LamMethod = "干复" | "干复蒸煮" | "无溶剂";
const LAM_PRICE: Record<LamMethod, number> = {
  "干复": 0.13, "干复蒸煮": 0.18, "无溶剂": 0.065
};

/** 制袋单价（元/米） */
const BAG_MAKE_RULES = {
  standup: { noZipper: 0.09, zipper: 0.19 },
  threeSide: { "单排": 0.045, "双排": 0.03, "三排": 0.0225 },
  centerAndGussetPerMeterHeight: 0.04,
  eightSide: { noZipper: 0.28, zipperNormal: 0.5, zipperEasyTear: 0.75 },
};

/** 其他费用 */
const EXTRA = { foilAreaPricePerM2: 1.2, foilPerTimeSingleRow: 0.2, foilPerTimeDoubleRowAdd: 0.1, valvePerUnit: 0.11, handlePerUnit: 0.15 };
const LABOR = { thresholdMm: 140, small: 0.024, large: 0.026 };
const SETUP = { perColor: 200, maxColors: 9 };

/** 数量折扣 */
function moqDiscount(qty: number) {
  if (qty >= 100000) return 0.96;
  if (qty >= 50000) return 0.98;
  if (qty >= 30000) return 1.0;
  if (qty >= 20000) return 1.15;
  if (qty >= 10000) return 1.3;
  return 1.4;
}

/** 工具 */
const inchToMm = (inch: number) => inch * 25.4;
const mmToM = (mm: number) => mm / 1000;
const mm2ToM2 = (mm2: number) => mm2 / 1_000_000;

function moneyRMB(v: number) { return "¥" + (isFinite(v) ? v.toFixed(2) : "0.00"); }
function moneyUSD(v: number, rate: number) { return "$" + (isFinite(v) && rate > 0 ? (v / rate).toFixed(2) : "0.00"); }

/** 类型 */
interface Layer {
  id: number;
  materialName: string;           // 选项或“自定义…”
  custom?: { name: string; type: "plastic" | "paper"; thickness?: number; density?: number; grammage?: number; pricePerKg: number; }
}
interface LamJoin { id: number; method: LamMethod; } // 第 i 次复合方式（层数 n => n-1 次）

export default function App() {
  /** 基础输入 */
  const [unit, setUnit] = useState<Unit>("mm");
  const [bagType, setBagType] = useState<BagType>("站立袋");
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [bottomInsert, setBottomInsert] = useState(0);
  const [backSeam, setBackSeam] = useState(10); // mm: 1cm 默认
  const [sideGusset, setSideGusset] = useState(0);
  const [rows, setRows] = useState<"单排"|"双排"|"三排">("单排");
  const [quantity, setQuantity] = useState(30000);
  const [fxRate, setFxRate] = useState(7.2);

  /** 多层材料（默认两层） */
  const [layers, setLayers] = useState<Layer[]>([
    { id: 1, materialName: "PET-12μm" },
    { id: 2, materialName: "PE-40μm" },
  ]);

  /** 复合方式数组（长度 = 层数-1） */
  const [joins, setJoins] = useState<LamJoin[]>([
    { id: 1, method: "干复" }
  ]);

  /** 印刷（只算一次，与层数无关） */
  const [coverage, setCoverage] = useState<PrintCoverage>("100"); // 覆盖率档位

  /** 制袋相关 */
  const [zipper, setZipper] = useState<"否" | "是" | "易撕拉链">("是");

  /** 附加工艺&人工 */
  const [foilRow, setFoilRow] = useState<"无"|"单排"|"双排">("无");
  const [foilAreaMm2, setFoilAreaMm2] = useState(0);
  const [valveCount, setValveCount] = useState(0);
  const [handleCount, setHandleCount] = useState(0);

  /** 版费&上机费（与单袋价分开） */
  const [colorCount, setColorCount] = useState(3);   // 色数 = 上机 ×200 元/色
  const [plateCount, setPlateCount] = useState(3);   // 版支数
  const [plateLength, setPlateLength] = useState<860|1100>(860); // cm单位见下，实际输入的是 mm，计算时转 cm
  const [plateRoundCm, setPlateRoundCm] = useState(40); // 版周(cm)

  /** ———— 尺寸统一到 mm ———— */
  const widthMm       = unit === "inch" ? inchToMm(width) : width;
  const heightMm      = unit === "inch" ? inchToMm(height) : height;
  const bottomInsertMm= unit === "inch" ? inchToMm(bottomInsert) : bottomInsert;
  const backSeamMm    = unit === "inch" ? inchToMm(backSeam) : backSeam;
  const sideGussetMm  = unit === "inch" ? inchToMm(sideGusset) : sideGusset;

  /** 展开面积 (mm²/袋) */
  const areaMm2 = useMemo(() => {
    switch (bagType) {
      case "站立袋": return widthMm * (heightMm + bottomInsertMm) * 2;
      case "三边封袋": return widthMm * heightMm * 2;
      case "中封袋": return (widthMm + 2 * backSeamMm) * heightMm;
      case "风琴袋": return (widthMm + 2 * backSeamMm + 2 * sideGussetMm) * heightMm;
      case "八边封袋":
        return ( (heightMm + heightMm + bottomInsertMm + 30) * (widthMm + 6)
               + (sideGussetMm + 6) * 2 * (heightMm + 10) );
      default: return widthMm * heightMm * 2;
    }
  }, [bagType, widthMm, heightMm, bottomInsertMm, backSeamMm, sideGussetMm]);
  const areaM2 = mm2ToM2(areaMm2);

  /** 人工/袋（按带宽阈值） */
  const laborPerBag = widthMm <= LABOR.thresholdMm ? LABOR.small : LABOR.large;

  /** 层数变化时，同步复合次数 joins = n-1 */
  const ensureJoinCount = (n: number) => {
    const need = Math.max(n - 1, 0);
    setJoins(prev => {
      const arr = [...prev];
      if (arr.length < need) {
        for (let i = arr.length; i < need; i++) arr.push({ id: i+1, method: "干复" });
      } else if (arr.length > need) {
        arr.length = need;
      }
      return [...arr];
    });
  };

  /** 材料成本/袋（塑料：面积×厚度×密度→kg，纸：面积×克重→kg） */
  const materialCostPerBag = useMemo(() => {
    let sum = 0;
    layers.forEach(l => {
      const preset = MATERIAL_OPTIONS.find(m => m.name === l.materialName);
      const def = l.materialName === "自定义…" ? l.custom : (preset as any);
      if (!def) return;

      if (def.type === "plastic") {
        const thicknessMm = def.thickness ?? 0;
        const volumeMm3 = areaMm2 * thicknessMm;     // mm³
        const density_g_per_cm3 = def.density ?? 0;
        // 1 cm³ = 1000 mm³ => 体积(cm³) = volumeMm3 / 1000
        const weight_g = (volumeMm3 / 1000) * density_g_per_cm3;
        const weight_kg = weight_g / 1000;
        sum += weight_kg * def.pricePerKg;
      } else if (def.type === "paper") {
        const grammage_g_per_m2 = def.grammage ?? 0;
        const weight_g = areaM2 * grammage_g_per_m2;
        const weight_kg = weight_g / 1000;
        sum += weight_kg * def.pricePerKg;
      }
    });
    return sum;
  }, [layers, areaMm2, areaM2]);

  /** 印刷费/袋（只算一次，按覆盖率价 × 面积） */
  const printCostPerBag = useMemo(() => areaM2 * PRINT_PRICE[coverage], [areaM2, coverage]);

  /** 复合费/袋（每次复合按所选方式价 × 面积） */
  const lamCostPerBag = useMemo(() => {
    return joins.reduce((acc, j) => acc + areaM2 * LAM_PRICE[j.method], 0);
  }, [joins, areaM2]);

  /** 制袋费/袋（按袋型规则） */
  const bagMakePerBag = useMemo(() => {
    if (bagType === "站立袋") {
      const rate = zipper === "是" ? BAG_MAKE_RULES.standup.zipper : BAG_MAKE_RULES.standup.noZipper;
      return rate * mmToM(widthMm);
    }
    if (bagType === "三边封袋") {
      const shortM = Math.min(mmToM(widthMm), mmToM(heightMm));
      return BAG_MAKE_RULES.threeSide[rows] * shortM;
    }
    if (bagType === "中封袋" || bagType === "风琴袋") {
      return BAG_MAKE_RULES.centerAndGussetPerMeterHeight * mmToM(heightMm);
    }
    if (bagType === "八边封袋") {
      let rate = BAG_MAKE_RULES.eightSide.noZipper;
      if (zipper === "是") rate = BAG_MAKE_RULES.eightSide.zipperNormal;
      if (zipper === "易撕拉链") rate = BAG_MAKE_RULES.eightSide.zipperEasyTear;
      return rate * mmToM(widthMm);
    }
    return 0;
  }, [bagType, widthMm, heightMm, rows, zipper]);

  /** 附加工艺/袋（烫金、阀、手提 + 人工） */
  const extraPerBag = useMemo(() => {
    let sum = 0;
    if (foilRow !== "无" && foilAreaMm2 > 0) {
      const areaM2Local = mm2ToM2(foilAreaMm2);
      let perTime = EXTRA.foilPerTimeSingleRow;
      if (foilRow === "双排") perTime += EXTRA.foilPerTimeDoubleRowAdd;
      sum += areaM2Local * EXTRA.foilAreaPricePerM2 + perTime;
    }
    sum += valveCount * EXTRA.valvePerUnit;
    sum += handleCount * EXTRA.handlePerUnit;
    sum += laborPerBag;
    return sum;
  }, [foilRow, foilAreaMm2, valveCount, handleCount, laborPerBag]);

  /** 单袋（不含版费与上机费） */
  const perBagRMB = materialCostPerBag + printCostPerBag + lamCostPerBag + bagMakePerBag + extraPerBag;

  /** 版费总和（按支，不摊入单袋） */
  const plateTotalRMB = useMemo(() => {
    const plateLenCm = plateLength / 10; // 输入为 mm，换算 cm
    return plateCount * plateLenCm * plateRoundCm * 0.11;
  }, [plateCount, plateLength, plateRoundCm]);

  /** 上机费总和（按色，不摊入单袋） */
  const setupTotalRMB = useMemo(() => {
    const colors = Math.min(colorCount, SETUP.maxColors);
    return colors * SETUP.perColor;
  }, [colorCount]);

  /** 折扣 */
  const discount = useMemo(() => moqDiscount(quantity), [quantity]);

  /** 订单总价（单袋×数量×折扣 + 版费 + 上机费） */
  const orderTotalRMB = perBagRMB * quantity * discount + plateTotalRMB + setupTotalRMB;

  /** —— 交互：层/复合/材料自定义 —— */
  const addLayer = () => {
    const id = (layers.at(-1)?.id ?? 0) + 1;
    const newLayers = [...layers, { id, materialName: "PET-12μm" }];
    setLayers(newLayers);
    ensureJoinCount(newLayers.length);
  };
  const removeLayer = (id: number) => {
    if (layers.length <= 1) return;
    const newLayers = layers.filter(l => l.id !== id);
    setLayers(newLayers);
    ensureJoinCount(newLayers.length);
  };
  const updateLayerMaterial = (id: number, val: string) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, materialName: val, custom: val==="自定义…" ? { name: "", type:"plastic", thickness: 0, density: 0, pricePerKg: 0 } : undefined } : l));
  };
  const updateLayerCustom = (id:number, key: keyof NonNullable<Layer["custom"]>, value: any) => {
    setLayers(prev => prev.map(l => {
      if (l.id !== id) return l;
      return { ...l, custom: { ...(l.custom||{name:"",type:"plastic",pricePerKg:0}), [key]: value } };
    }));
  };

  const updateJoin = (id:number, method: LamMethod) => {
    setJoins(prev => prev.map(j => j.id===id ? ({...j, method}) : j));
  };

  /** 展示条件 */
  const showBottomInsert = bagType==="站立袋" || bagType==="八边封袋";
  const showBackSeam   = bagType==="中封袋" || bagType==="风琴袋";
  const showSideGusset = bagType==="风琴袋" || bagType==="八边封袋";
  const showRows       = bagType==="三边封袋";

  return (
    <div className="app">
      <h1>📦 包装袋自动报价系统</h1>

      {/* 上：输入区（默认折叠） */}
      <details open>
        <summary>输入参数（尺寸 / 材料 / 工艺 / 印刷 / 版费）</summary>
        <div className="section" style={{padding:12, marginTop:8}}>
          {/* 基础参数 */}
          <h3>基础参数</h3>
          <div className="grid-six">
            <div className="input-group">
              <label>袋型</label>
              <select value={bagType} onChange={e=>setBagType(e.target.value as BagType)}>
                <option value="站立袋">站立袋</option>
                <option value="三边封袋">三边封袋</option>
                <option value="中封袋">中封袋</option>
                <option value="风琴袋">风琴袋</option>
                <option value="八边封袋">八边封袋</option>
              </select>
            </div>
            <div className="input-group">
              <label>单位</label>
              <select value={unit} onChange={e=>setUnit(e.target.value as Unit)}>
                <option value="mm">mm</option>
                <option value="inch">inch</option>
              </select>
            </div>
            <div className="input-group">
              <label>宽 ({unit})</label>
              <input type="number" value={width||""} onChange={e=>setWidth(parseFloat(e.target.value)||0)} />
            </div>
            <div className="input-group">
              <label>高 ({unit})</label>
              <input type="number" value={height||""} onChange={e=>setHeight(parseFloat(e.target.value)||0)} />
            </div>
            {showBottomInsert && (
              <div className="input-group">
                <label>底插入 ({unit})</label>
                <input type="number" value={bottomInsert||""} onChange={e=>setBottomInsert(parseFloat(e.target.value)||0)} />
              </div>
            )}
            {showBackSeam && (
              <div className="input-group">
                <label>背封边 ({unit})</label>
                <input type="number" value={backSeam||""} onChange={e=>setBackSeam(parseFloat(e.target.value)||0)} />
              </div>
            )}
            {showSideGusset && (
              <div className="input-group">
                <label>侧面展开 ({unit})</label>
                <input type="number" value={sideGusset||""} onChange={e=>setSideGusset(parseFloat(e.target.value)||0)} />
              </div>
            )}
            {showRows && (
              <div className="input-group">
                <label>排数</label>
                <select value={rows} onChange={e=>setRows(e.target.value as any)}>
                  <option value="单排">单排</option><option value="双排">双排</option><option value="三排">三排</option>
                </select>
              </div>
            )}
            <div className="input-group">
              <label>数量（个）</label>
              <input type="number" value={quantity||""} onChange={e=>setQuantity(parseInt(e.target.value)||0)} />
            </div>
            <div className="input-group">
              <label>美元汇率</label>
              <input type="number" step="0.01" value={fxRate} onChange={e=>setFxRate(parseFloat(e.target.value)||0)} />
            </div>
          </div>

          {/* 材料层 */}
          <h3 style={{marginTop:16}}>材料层</h3>
          {layers.map(l=>(
            <div key={l.id} className="layers-grid" style={{alignItems:"center", marginBottom:8}}>
              <div className="layer-item" style={{display:"grid", gridTemplateColumns:"100px 1fr", gap:8}}>
                <div className="layer-label">第{l.id}层</div>
                <select value={l.materialName} onChange={e=>updateLayerMaterial(l.id, e.target.value)}>
                  {MATERIAL_OPTIONS.map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
                </select>
              </div>

              {l.materialName==="自定义…" && (
                <div style={{display:"grid", gridTemplateColumns:"repeat(6, 1fr)", gap:8, width:"100%"}}>
                  <div className="input-group"><label>名称</label><input value={l.custom?.name||""} onChange={e=>updateLayerCustom(l.id,"name", e.target.value)} /></div>
                  <div className="input-group">
                    <label>类型</label>
                    <select value={l.custom?.type||"plastic"} onChange={e=>updateLayerCustom(l.id,"type", e.target.value as any)}>
                      <option value="plastic">塑料</option>
                      <option value="paper">纸</option>
                    </select>
                  </div>
                  {l.custom?.type==="plastic" ? (
                    <>
                      <div className="input-group"><label>厚度(μm)</label><input type="number" value={l.custom?.thickness||0} onChange={e=>updateLayerCustom(l.id,"thickness", parseFloat(e.target.value)||0)} /></div>
                      <div className="input-group"><label>密度(g/cm³)</label><input type="number" step="0.01" value={l.custom?.density||0} onChange={e=>updateLayerCustom(l.id,"density", parseFloat(e.target.value)||0)} /></div>
                      <div className="input-group"><label>单价(元/kg)</label><input type="number" step="0.01" value={l.custom?.pricePerKg||0} onChange={e=>updateLayerCustom(l.id,"pricePerKg", parseFloat(e.target.value)||0)} /></div>
                    </>
                  ) : (
                    <>
                      <div className="input-group"><label>克重(g/m²)</label><input type="number" value={l.custom?.grammage||0} onChange={e=>updateLayerCustom(l.id,"grammage", parseFloat(e.target.value)||0)} /></div>
                      <div className="input-group"><label>单价(元/kg)</label><input type="number" step="0.01" value={l.custom?.pricePerKg||0} onChange={e=>updateLayerCustom(l.id,"pricePerKg", parseFloat(e.target.value)||0)} /></div>
                    </>
                  )}
                </div>
              )}

              {layers.length>1 && <button className="remove-btn" onClick={()=>removeLayer(l.id)}>删除</button>}
            </div>
          ))}
          {layers.length<4 && <button onClick={addLayer}>+ 添加材料层</button>}
          <div style={{marginTop:6, color:"#666"}}>复合次数：{Math.max(layers.length-1,0)} 次</div>

          {/* 复合方式（逐次） */}
          {joins.length>0 && (
            <>
              <h4 style={{marginTop:10}}>复合方式</h4>
              <div style={{display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:8}}>
                {joins.map(j=>(
                  <div key={j.id} className="input-group">
                    <label>第{j.id}次</label>
                    <select value={j.method} onChange={e=>updateJoin(j.id, e.target.value as LamMethod)}>
                      <option value="干复">干复</option>
                      <option value="干复蒸煮">干复（蒸煮）</option>
                      <option value="无溶剂">无溶剂</option>
                    </select>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* 印刷（只算一次） */}
          <h3 style={{marginTop:16}}>印刷</h3>
          <div className="grid-six">
            <div className="input-group">
              <label>覆盖率档位</label>
              <select value={coverage} onChange={e=>setCoverage(e.target.value as PrintCoverage)}>
                <option value="25">25%</option><option value="50">50%</option>
                <option value="100">100%</option><option value="150">150%</option>
                <option value="200">200%（镀铝/白底+印刷）</option>
                <option value="300">300%（哑油）</option>
              </select>
            </div>
          </div>

          {/* 制袋/工艺 */}
          <h3 style={{marginTop:16}}>制袋与附加工艺</h3>
          <div className="grid-six">
            <div className="input-group">
              <label>拉链</label>
              <select value={zipper} onChange={e=>setZipper(e.target.value as any)}>
                <option value="否">无</option>
                <option value="是">普通拉链</option>
                <option value="易撕拉链">易撕拉链</option>
              </select>
            </div>
            <div className="input-group">
              <label>烫金行数</label>
              <select value={foilRow} onChange={e=>setFoilRow(e.target.value as any)}>
                <option value="无">无</option><option value="单排">单排</option><option value="双排">双排</option>
              </select>
            </div>
            <div className="input-group">
              <label>烫金面积(mm²)</label>
              <input type="number" value={foilAreaMm2||""} onChange={e=>setFoilAreaMm2(parseFloat(e.target.value)||0)} />
            </div>
            <div className="input-group"><label>透气阀(个)</label><input type="number" value={valveCount||""} onChange={e=>setValveCount(parseInt(e.target.value)||0)} /></div>
            <div className="input-group"><label>手提(个)</label><input type="number" value={handleCount||""} onChange={e=>setHandleCount(parseInt(e.target.value)||0)} /></div>
          </div>

          {/* 版费 / 上机费 —— 独立结算 */}
          <h3 style={{marginTop:16}}>版费与上机（独立结算）</h3>
          <div className="grid-six">
            <div className="input-group"><label>色数（上机）</label><input type="number" min={1} max={9} value={colorCount} onChange={e=>setColorCount(parseInt(e.target.value)||0)} /></div>
            <div className="input-group"><label>版支数</label><input type="number" min={1} value={plateCount} onChange={e=>setPlateCount(parseInt(e.target.value)||0)} /></div>
            <div className="input-group">
              <label>版长</label>
              <select value={plateLength} onChange={e=>setPlateLength(parseInt(e.target.value) as 860|1100)}>
                <option value={860}>860（膜宽 ≤ 800）</option>
                <option value={1100}>1100（膜宽 &gt; 800）</option>
              </select>
            </div>
            <div className="input-group"><label>版周(cm)</label><input type="number" value={plateRoundCm||0} onChange={e=>setPlateRoundCm(parseFloat(e.target.value)||0)} /></div>
          </div>
        </div>
      </details>

      {/* 下：报价结果 */}
      <div className="section" style={{padding:12, marginTop:10}}>
        <h2>报价结果</h2>

        {/* 核心价格 */}
        <div className="highlight" style={{margin:"8px 0 12px"}}>
          <div className="price-row">
            <div className="price-item">
              <div className="price-label">总价（含版费/上机费）：</div>
              <div className="price-value">{moneyRMB(orderTotalRMB)} / {moneyUSD(orderTotalRMB, fxRate)}</div>
            </div>
            <div className="price-item">
              <div className="price-label">单袋成本（不含版/上机）：</div>
              <div className="price-value">{moneyRMB(perBagRMB * discount)} / {moneyUSD(perBagRMB * discount, fxRate)}</div>
            </div>
          </div>
        </div>

        {/* 费用明细（默认折叠） */}
        <details>
          <summary>费用明细（展开查看公式与数值）</summary>
          <div style={{marginTop:8}}>
            <details>
              <summary>面积</summary>
              <p>展开面积：{areaM2.toFixed(6)} m²/袋</p>
            </details>

            <details>
              <summary>材料成本</summary>
              <p>塑料：面积 × 厚度(μm) × 密度(g/cm³) → 重量(kg) × 单价(元/kg)</p>
              <p>纸类：面积(m²) × 克重(g/m²) → 重量(kg) × 单价(元/kg)</p>
              <p>本次合计：{moneyRMB(materialCostPerBag)}</p>
            </details>

            <details>
              <summary>印刷成本（只算一次）</summary>
              <p>印刷：面积 × 覆盖率单价（{coverage}% → {PRINT_PRICE[coverage]} 元/m²）</p>
              <p>本次合计：{moneyRMB(printCostPerBag)}</p>
            </details>

            <details>
              <summary>复合成本（逐次）</summary>
              <ul>
                {joins.map(j=>(
                  <li key={j.id}>第{j.id}次：面积 × {j.method}({LAM_PRICE[j.method]} 元/m²)</li>
                ))}
              </ul>
              <p>本次合计：{moneyRMB(lamCostPerBag)}</p>
            </details>

            <details>
              <summary>制袋成本</summary>
              <p>规则依据袋型（站立、三边封、中封、风琴、八边封）与带宽/袋高计算</p>
              <p>本次合计：{moneyRMB(bagMakePerBag)}</p>
            </details>

            <details>
              <summary>附加工艺与人工</summary>
              <p>烫金：面积(m²)×1.2 + 次费（单排0.2，双排+0.1）</p>
              <p>透气阀：0.11 元/个；手提：0.15 元/个；人工：≤14cm 0.024 / &gt;14cm 0.026 元/袋</p>
              <p>本次合计：{moneyRMB(extraPerBag)}</p>
            </details>

            <details>
              <summary>版费（独立结算）</summary>
              <p>版费 = 版支数 × 版长(cm) × 版周(cm) × 0.11</p>
              <p>输入：{plateCount} 支，版长 {plateLength/10} cm，版周 {plateRoundCm} cm</p>
              <p>本次合计：{moneyRMB(plateTotalRMB)}</p>
            </details>

            <details>
              <summary>上机费（独立结算）</summary>
              <p>上机费 = 色数 × 200 元；色数由产品图分解，不与材料层数相关</p>
              <p>输入：{colorCount} 色，合计：{moneyRMB(setupTotalRMB)}</p>
            </details>

            <details open>
              <summary>汇总</summary>
              <p>单袋成本（不含版/上机）= （材料 + 印刷 + 复合 + 制袋 + 工艺）× 数量系数</p>
              <p>订单总价 = 单袋成本×数量 + 版费 + 上机费</p>
              <p>单袋（折扣后）：{moneyRMB(perBagRMB * discount)}；订单总价：{moneyRMB(orderTotalRMB)}</p>
            </details>
          </div>
        </details>
      </div>
    </div>
  );
}
