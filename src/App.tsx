import { useState, useEffect } from 'react';
import './App.css';

// 材料层接口
interface MaterialLayer {
  id: number;
  thickness: number; // μm
  density: number; // g/cm³
  price: number; // 元/kg
}

// 印刷覆盖率价格表
const printCoveragePrices = {
  25: 0.08,
  50: 0.12,
  100: 0.16,
  150: 0.20,
  200: 0.24,
  300: 0.32
};

// 复合方式价格
const compositePrices = {
  '干复': 0.015,
  '干复蒸煮': 0.025,
  '无溶剂': 0.012
};

// 额外工艺价格
const extraProcessPrices = {
  '烫金': 0.002, // 元/cm²
  '铁丝条': 0.08, // 元/条
  '阀': 0.12, // 元/个
  '激凸': 0.001, // 元/cm²
  '手提': 0.15 // 元/个
};

function App() {
  // 基础参数
  const [width, setWidth] = useState<number>(0);
  const [height, setHeight] = useState<number>(0);
  const [bottomInsert, setBottomInsert] = useState<number>(0);
  const [quantity, setQuantity] = useState<number>(0);
  const [unit, setUnit] = useState<'cm' | 'inch'>('cm');

  // 材料层
  const [materials, setMaterials] = useState<MaterialLayer[]>([
    { id: 1, thickness: 0, density: 0, price: 0 }
  ]);

  // 印刷方式
  const [printMethod, setPrintMethod] = useState<'凹印' | '柔印'>('凹印');
  const [coverage, setCoverage] = useState<keyof typeof printCoveragePrices>(100);
  const [isAluminum, setIsAluminum] = useState<boolean>(false);
  const [isMatte, setIsMatte] = useState<boolean>(false);

  // 复合方式
  const [compositeMethod, setCompositeMethod] = useState<keyof typeof compositePrices>('干复');

  // 制袋方式
  const [hasZipper, setHasZipper] = useState<'是' | '否'>('否');

  // 额外工艺
  const [foilStamping, setFoilStamping] = useState<'无' | '单排' | '双排'>('无');
  const [foilArea, setFoilArea] = useState<number>(0);
  const [wireCount, setWireCount] = useState<0 | 1 | 2 | 3>(0);
  const [valveCount, setValveCount] = useState<0 | 1 | 2>(0);
  const [embossing, setEmbossing] = useState<'无' | '单排' | '双排'>('无');
  const [handleCount, setHandleCount] = useState<0 | 1 | 2>(0);

  // 计算结果
  const [calculationResult, setCalculationResult] = useState<any>(null);

  // 添加材料层
  const addMaterialLayer = () => {
    const newId = Math.max(...materials.map(m => m.id)) + 1;
    setMaterials([...materials, { id: newId, thickness: 0, density: 0, price: 0 }]);
  };

  // 删除材料层
  const removeMaterialLayer = (id: number) => {
    if (materials.length > 1) {
      setMaterials(materials.filter(m => m.id !== id));
    }
  };

  // 更新材料层
  const updateMaterialLayer = (id: number, field: keyof MaterialLayer, value: number) => {
    setMaterials(materials.map(m => 
      m.id === id ? { ...m, [field]: value } : m
    ));
  };

  // 单位转换
  const convertToCm = (value: number): number => {
    return unit === 'inch' ? value * 2.54 : value;
  };

  // 计算成本
  const calculateCosts = () => {
    const widthCm = convertToCm(width);
    const heightCm = convertToCm(height);
    const bottomInsertCm = convertToCm(bottomInsert);

    // 计算展开宽
    const expandedWidth = (widthCm + heightCm) * 2 + bottomInsertCm;
    
    // 计算面积 (m²)
    const area = (expandedWidth * heightCm) / 10000;

    const result: any = {
      basicParams: { widthCm, heightCm, bottomInsertCm, expandedWidth, area, quantity },
      materials: [],
      totalMaterialCost: 0,
      printCost: 0,
      compositeCost: 0,
      cuttingCost: 0,
      bagCost: 0,
      laborCost: 0,
      extraProcessCost: 0,
      plateFee: 0,
      setupFee: 0,
      singleBagCost: 0,
      totalCost: 0
    };

    // 计算材料成本
    materials.forEach((material, index) => {
      if (material.thickness > 0 && material.density > 0 && material.price > 0) {
        // 厚度从μm转换为cm
        const thicknessCm = material.thickness / 10000;
        // 材料重量 (kg)
        const weight = thicknessCm * material.density * area;
        // 材料成本
        const materialCost = weight * material.price;
        
        result.materials.push({
          layer: index + 1,
          thickness: material.thickness,
          density: material.density,
          price: material.price,
          weight,
          cost: materialCost
        });
        
        result.totalMaterialCost += materialCost;
      }
    });

    // 计算印刷成本
    if (printMethod === '凹印') {
      result.printCost = printCoveragePrices[coverage] * area;
      if (isAluminum) result.printCost *= 1.2;
      if (isMatte) result.printCost *= 1.1;
    } else {
      result.printCost = 0.18 * area; // 柔印固定单价
    }

    // 计算复合成本
    result.compositeCost = compositePrices[compositeMethod] * area;

    // 计算分切成本
    result.cuttingCost = area * 0.03;

    // 计算制袋成本
    if (hasZipper === '是') {
      result.bagCost = 0.19 * expandedWidth / 100 * widthCm / 100;
    } else {
      result.bagCost = 0.09 * expandedWidth / 100 * widthCm / 100;
    }

    // 计算人工成本
    result.laborCost = expandedWidth < 14 ? 0.024 : 0.026;

    // 计算额外工艺成本
    let extraCost = 0;
    
    // 烫金
    if (foilStamping !== '无' && foilArea > 0) {
      extraCost += extraProcessPrices['烫金'] * foilArea;
      if (foilStamping === '双排') extraCost *= 2;
    }
    
    // 铁丝条
    extraCost += extraProcessPrices['铁丝条'] * wireCount;
    
    // 阀
    extraCost += extraProcessPrices['阀'] * valveCount;
    
    // 激凸
    if (embossing !== '无') {
      extraCost += extraProcessPrices['激凸'] * foilArea; // 假设激凸面积与烫金相同
      if (embossing === '双排') extraCost *= 2;
    }
    
    // 手提
    extraCost += extraProcessPrices['手提'] * handleCount;
    
    result.extraProcessCost = extraCost;

    // 计算版费和上机费
    result.plateFee = (860 * 400 * 0.11) / quantity;
    result.setupFee = (200 * 6) / quantity;

    // 计算单袋成本
    result.singleBagCost = 
      result.totalMaterialCost + 
      result.printCost + 
      result.compositeCost + 
      result.cuttingCost + 
      result.bagCost + 
      result.laborCost + 
      result.extraProcessCost + 
      result.plateFee + 
      result.setupFee;

    // 计算总成本
    result.totalCost = result.singleBagCost * quantity;

    setCalculationResult(result);
  };

  // 当参数变化时自动重新计算
  useEffect(() => {
    if (width > 0 && height > 0 && quantity > 0) {
      calculateCosts();
    }
  }, [width, height, bottomInsert, quantity, unit, materials, printMethod, coverage, isAluminum, isMatte, compositeMethod, hasZipper, foilStamping, foilArea, wireCount, valveCount, embossing, handleCount]);

  return (
    <div className="app">
      <h1>站立袋自动报价器</h1>
      
      <div className="main-container">
        {/* 左侧输入区 */}
        <div className="input-section">
          <h2>输入参数</h2>
          
          {/* 基础参数 */}
          <div className="section">
            <h3>基础参数</h3>
            <div className="input-group">
              <label>单位：</label>
              <select value={unit} onChange={(e) => setUnit(e.target.value as 'cm' | 'inch')}>
                <option value="cm">厘米 (cm)</option>
                <option value="inch">英寸 (inch)</option>
              </select>
            </div>
            <div className="input-group">
              <label>成品宽度 ({unit})：</label>
              <input 
                type="number" 
                step="0.01" 
                value={width || ''} 
                onChange={(e) => setWidth(parseFloat(e.target.value) || 0)} 
              />
            </div>
            <div className="input-group">
              <label>成品高度 ({unit})：</label>
              <input 
                type="number" 
                step="0.01" 
                value={height || ''} 
                onChange={(e) => setHeight(parseFloat(e.target.value) || 0)} 
              />
            </div>
            <div className="input-group">
              <label>底插入 ({unit})：</label>
              <input 
                type="number" 
                step="0.01" 
                value={bottomInsert || ''} 
                onChange={(e) => setBottomInsert(parseFloat(e.target.value) || 0)} 
              />
            </div>
            <div className="input-group">
              <label>订单数量：</label>
              <input 
                type="number" 
                value={quantity || ''} 
                onChange={(e) => setQuantity(parseInt(e.target.value) || 0)} 
              />
            </div>
          </div>

          {/* 材料层 */}
          <div className="section">
            <h3>材料层</h3>
            {materials.map((material) => (
              <div key={material.id} className="material-layer">
                <h4>第{material.id}层</h4>
                <div className="input-group">
                  <label>厚度 (μm)：</label>
                  <input 
                    type="number" 
                    step="1" 
                    value={material.thickness || ''} 
                    onChange={(e) => updateMaterialLayer(material.id, 'thickness', parseFloat(e.target.value) || 0)} 
                  />
                </div>
                <div className="input-group">
                  <label>密度 (g/cm³)：</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={material.density || ''} 
                    onChange={(e) => updateMaterialLayer(material.id, 'density', parseFloat(e.target.value) || 0)} 
                  />
                </div>
                <div className="input-group">
                  <label>单价 (元/kg)：</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={material.price || ''} 
                    onChange={(e) => updateMaterialLayer(material.id, 'price', parseFloat(e.target.value) || 0)} 
                  />
                </div>
                {materials.length > 1 && (
                  <button onClick={() => removeMaterialLayer(material.id)} className="remove-btn">
                    删除此层
                  </button>
                )}
              </div>
            ))}
            <button onClick={addMaterialLayer} className="add-btn">添加材料层</button>
          </div>

          {/* 印刷方式 */}
          <div className="section">
            <h3>印刷方式</h3>
            <div className="input-group">
              <label>印刷方式：</label>
              <select value={printMethod} onChange={(e) => setPrintMethod(e.target.value as '凹印' | '柔印')}>
                <option value="凹印">凹印</option>
                <option value="柔印">柔印</option>
              </select>
            </div>
            {printMethod === '凹印' && (
              <>
                <div className="input-group">
                  <label>覆盖率：</label>
                  <select value={coverage} onChange={(e) => setCoverage(parseInt(e.target.value) as keyof typeof printCoveragePrices)}>
                    <option value={25}>25%</option>
                    <option value={50}>50%</option>
                    <option value={100}>100%</option>
                    <option value={150}>150%</option>
                    <option value={200}>200%</option>
                    <option value={300}>300%</option>
                  </select>
                </div>
                <div className="input-group">
                  <label>
                    <input 
                      type="checkbox" 
                      checked={isAluminum} 
                      onChange={(e) => setIsAluminum(e.target.checked)} 
                    />
                    镀铝
                  </label>
                </div>
                <div className="input-group">
                  <label>
                    <input 
                      type="checkbox" 
                      checked={isMatte} 
                      onChange={(e) => setIsMatte(e.target.checked)} 
                    />
                    哑油
                  </label>
                </div>
              </>
            )}
          </div>

          {/* 复合方式 */}
          <div className="section">
            <h3>复合方式</h3>
            <div className="input-group">
              <label>复合方式：</label>
              <select value={compositeMethod} onChange={(e) => setCompositeMethod(e.target.value as keyof typeof compositePrices)}>
                <option value="干复">干复</option>
                <option value="干复蒸煮">干复蒸煮</option>
                <option value="无溶剂">无溶剂</option>
              </select>
            </div>
          </div>

          {/* 制袋方式 */}
          <div className="section">
            <h3>制袋方式</h3>
            <div className="input-group">
              <label>是否有拉链：</label>
              <select value={hasZipper} onChange={(e) => setHasZipper(e.target.value as '是' | '否')}>
                <option value="否">否</option>
                <option value="是">是</option>
              </select>
            </div>
          </div>

          {/* 额外工艺 */}
          <div className="section">
            <h3>额外工艺</h3>
            <div className="input-group">
              <label>烫金：</label>
              <select value={foilStamping} onChange={(e) => setFoilStamping(e.target.value as '无' | '单排' | '双排')}>
                <option value="无">无</option>
                <option value="单排">单排</option>
                <option value="双排">双排</option>
              </select>
              {foilStamping !== '无' && (
                <>
                  <label>烫金面积 (cm²)：</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={foilArea || ''} 
                    onChange={(e) => setFoilArea(parseFloat(e.target.value) || 0)} 
                  />
                </>
              )}
            </div>
            <div className="input-group">
              <label>铁丝条：</label>
              <select value={wireCount} onChange={(e) => setWireCount(parseInt(e.target.value) as 0 | 1 | 2 | 3)}>
                <option value={0}>无</option>
                <option value={1}>1条</option>
                <option value={2}>2条</option>
                <option value={3}>3条</option>
              </select>
            </div>
            <div className="input-group">
              <label>阀：</label>
              <select value={valveCount} onChange={(e) => setValveCount(parseInt(e.target.value) as 0 | 1 | 2)}>
                <option value={0}>无</option>
                <option value={1}>1个</option>
                <option value={2}>2个</option>
              </select>
            </div>
            <div className="input-group">
              <label>激凸：</label>
              <select value={embossing} onChange={(e) => setEmbossing(e.target.value as '无' | '单排' | '双排')}>
                <option value="无">无</option>
                <option value="单排">单排</option>
                <option value="双排">双排</option>
              </select>
            </div>
            <div className="input-group">
              <label>手提：</label>
              <select value={handleCount} onChange={(e) => setHandleCount(parseInt(e.target.value) as 0 | 1 | 2)}>
                <option value={0}>无</option>
                <option value={1}>1个</option>
                <option value={2}>2个</option>
              </select>
            </div>
          </div>
        </div>

        {/* 右侧输出区 */}
        <div className="output-section">
          <h2>计算结果</h2>
          
          {calculationResult && (
            <div className="result-container">
              {/* 基础参数 */}
              <div className="result-section">
                <h3>基础参数</h3>
                <p>成品宽度：{calculationResult.basicParams.widthCm.toFixed(2)} cm</p>
                <p>成品高度：{calculationResult.basicParams.heightCm.toFixed(2)} cm</p>
                <p>底插入：{calculationResult.basicParams.bottomInsertCm.toFixed(2)} cm</p>
                <p>展开宽度：{calculationResult.basicParams.expandedWidth.toFixed(2)} cm</p>
                <p>面积：{calculationResult.basicParams.area.toFixed(6)} m²</p>
                <p>订单数量：{calculationResult.basicParams.quantity} 个</p>
              </div>

              {/* 材料成本 */}
              <div className="result-section">
                <h3>材料成本</h3>
                {calculationResult.materials.map((material: any, index: number) => (
                  <div key={index} className="material-result">
                    <p>第{material.layer}层：厚度 {material.thickness}μm, 密度 {material.density}g/cm³</p>
                    <p>重量：{material.weight.toFixed(6)} kg, 成本：¥{material.cost.toFixed(4)}</p>
                  </div>
                ))}
                <p className="total-cost">总材料成本：¥{calculationResult.totalMaterialCost.toFixed(4)}</p>
              </div>

              {/* 各项成本 */}
              <div className="result-section">
                <h3>各项成本</h3>
                <p>印刷成本：¥{calculationResult.printCost.toFixed(4)}</p>
                <p>复合成本：¥{calculationResult.compositeCost.toFixed(4)}</p>
                <p>分切成本：¥{calculationResult.cuttingCost.toFixed(4)}</p>
                <p>制袋成本：¥{calculationResult.bagCost.toFixed(4)}</p>
                <p>人工成本：¥{calculationResult.laborCost.toFixed(4)}</p>
                <p>额外工艺成本：¥{calculationResult.extraProcessCost.toFixed(4)}</p>
                <p>版费：¥{calculationResult.plateFee.toFixed(4)}</p>
                <p>上机费：¥{calculationResult.setupFee.toFixed(4)}</p>
              </div>

              {/* 最终结果 */}
              <div className="result-section final-result">
                <h3>最终报价</h3>
                <p className="single-cost">单袋成本：¥{calculationResult.singleBagCost.toFixed(4)}</p>
                <p className="total-cost">总成本：¥{calculationResult.totalCost.toFixed(2)}</p>
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
  );
}

export default App;
