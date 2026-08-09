import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../contexts/authContext'
import { adminService } from '../services/adminService'
import { AdminError, AdminLoading, AdminPageHeader, EmptyRow, formatDate } from '../components/AdminCommon'
import { useAdminToast } from '../components/AdminToast'

const CPU_EMPTY = { placaMaeId:'', processadorId:'', revisaoPlacaMae:'', biosMinima:'', compativel:true, observacao:'', fonteUrl:'', verificadoEm:'' }
const RAM_EMPTY = { placaMaeId:'', memoriaRamId:'', revisaoPlacaMae:'', biosTestada:'', familiaProcessadorTestada:'', frequenciaValidadaMhz:'', quantidadeModulosTestados:'', capacidadeTotalTestadaGb:'', compativel:true, constaNaQvl:true, observacao:'', fonteUrl:'', verificadoEm:'' }

function toIsoDate(value) {
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

export default function AdminCompatibility() {
  const { user } = useAuth()
  const canCreate = ['ADMIN','EDITOR'].includes(String(user?.papel || '').toUpperCase())
  const toast = useAdminToast()
  const [hardware, setHardware] = useState(null)
  const [cpuItems, setCpuItems] = useState(null)
  const [ramItems, setRamItems] = useState(null)
  const [error, setError] = useState(null)
  const [cpu, setCpu] = useState(CPU_EMPTY)
  const [ram, setRam] = useState(RAM_EMPTY)
  const [saving, setSaving] = useState('')

  async function load() {
    const [all, cpuList, ramList] = await Promise.all([
      adminService.hardwares.list(),
      adminService.hardwares.cpuMotherboardCompatibilities(),
      adminService.hardwares.ramMotherboardCompatibilities(),
    ])
    setHardware(all); setCpuItems(cpuList); setRamItems(ramList)
  }

  useEffect(() => { let active=true; Promise.all([adminService.hardwares.list(), adminService.hardwares.cpuMotherboardCompatibilities(), adminService.hardwares.ramMotherboardCompatibilities()]).then(([all,cpuList,ramList])=>{if(active){setHardware(all);setCpuItems(cpuList);setRamItems(ramList)}}).catch((err)=>active&&setError(err)); return()=>{active=false} }, [])

  const boards = useMemo(() => (hardware || []).filter((item) => item.categoria === 'PLACA_MAE'), [hardware])
  const cpus = useMemo(() => (hardware || []).filter((item) => item.categoria === 'PROCESSADOR'), [hardware])
  const rams = useMemo(() => (hardware || []).filter((item) => item.categoria === 'MEMORIA_RAM'), [hardware])

  async function submitCpu(event) {
    event.preventDefault(); setSaving('cpu')
    try {
      await adminService.hardwares.createCpuMotherboardCompatibility({
        placaMaeId:Number(cpu.placaMaeId), processadorId:Number(cpu.processadorId), revisaoPlacaMae:cpu.revisaoPlacaMae.trim()||undefined,
        biosMinima:cpu.biosMinima.trim()||undefined, compativel:Boolean(cpu.compativel), observacao:cpu.observacao.trim()||undefined,
        fonteUrl:cpu.fonteUrl.trim()||undefined, verificadoEm:toIsoDate(cpu.verificadoEm),
      })
      toast.show('Compatibilidade CPU × placa-mãe cadastrada.'); setCpu(CPU_EMPTY); await load()
    } catch (err) { toast.show(err.message,'erro') } finally { setSaving('') }
  }

  async function submitRam(event) {
    event.preventDefault(); setSaving('ram')
    try {
      await adminService.hardwares.createRamMotherboardCompatibility({
        placaMaeId:Number(ram.placaMaeId), memoriaRamId:Number(ram.memoriaRamId), revisaoPlacaMae:ram.revisaoPlacaMae.trim()||undefined,
        biosTestada:ram.biosTestada.trim()||undefined, familiaProcessadorTestada:ram.familiaProcessadorTestada.trim()||undefined,
        frequenciaValidadaMhz:ram.frequenciaValidadaMhz ? Number(ram.frequenciaValidadaMhz) : undefined,
        quantidadeModulosTestados:ram.quantidadeModulosTestados ? Number(ram.quantidadeModulosTestados) : undefined,
        capacidadeTotalTestadaGb:ram.capacidadeTotalTestadaGb ? Number(ram.capacidadeTotalTestadaGb) : undefined,
        compativel:Boolean(ram.compativel), constaNaQvl:Boolean(ram.constaNaQvl), observacao:ram.observacao.trim()||undefined,
        fonteUrl:ram.fonteUrl.trim()||undefined, verificadoEm:toIsoDate(ram.verificadoEm),
      })
      toast.show('Compatibilidade RAM × placa-mãe cadastrada.'); setRam(RAM_EMPTY); await load()
    } catch (err) { toast.show(err.message,'erro') } finally { setSaving('') }
  }

  if (error) return <AdminError error={error} />
  if (!hardware || !cpuItems || !ramItems) return <AdminLoading />

  return <>
    <AdminPageHeader title="Compatibilidade" description="Cadastre e revise as relações técnicas usadas pelo verificador do montador." />

    {canCreate && <section className="admin-dashboard-grid admin-compat-grid">
      <article className="admin-form-card"><form onSubmit={submitCpu}><section className="admin-form-section"><h2>CPU × Placa-mãe</h2><div className="admin-form-grid">
        <div className="admin-field"><label>Placa-mãe</label><select className="admin-select" required value={cpu.placaMaeId} onChange={(e)=>setCpu((c)=>({...c,placaMaeId:e.target.value}))}><option value="">Selecione</option>{boards.map((item)=><option key={item.id} value={item.id}>{item.nome}</option>)}</select></div>
        <div className="admin-field"><label>Processador</label><select className="admin-select" required value={cpu.processadorId} onChange={(e)=>setCpu((c)=>({...c,processadorId:e.target.value}))}><option value="">Selecione</option>{cpus.map((item)=><option key={item.id} value={item.id}>{item.nome}</option>)}</select></div>
        <div className="admin-field"><label>Revisão placa-mãe</label><input className="admin-input" value={cpu.revisaoPlacaMae} onChange={(e)=>setCpu((c)=>({...c,revisaoPlacaMae:e.target.value}))}/></div>
        <div className="admin-field"><label>BIOS mínima</label><input className="admin-input" value={cpu.biosMinima} onChange={(e)=>setCpu((c)=>({...c,biosMinima:e.target.value}))}/></div>
        <div className="admin-field full"><label>Fonte da informação</label><input className="admin-input" type="url" value={cpu.fonteUrl} onChange={(e)=>setCpu((c)=>({...c,fonteUrl:e.target.value}))}/></div>
        <div className="admin-field"><label>Verificado em</label><input className="admin-input" type="date" value={cpu.verificadoEm} onChange={(e)=>setCpu((c)=>({...c,verificadoEm:e.target.value}))}/></div>
        <div className="admin-field admin-field--boolean"><label className="admin-switch"><input type="checkbox" checked={cpu.compativel} onChange={(e)=>setCpu((c)=>({...c,compativel:e.target.checked}))}/> Compatível</label></div>
        <div className="admin-field full"><label>Observação</label><textarea className="admin-textarea" value={cpu.observacao} onChange={(e)=>setCpu((c)=>({...c,observacao:e.target.value}))}/></div>
      </div></section><footer className="admin-form-footer"><button className="btn btn-primario" disabled={saving==='cpu'}>{saving==='cpu'?'Salvando...':'Cadastrar relação'}</button></footer></form></article>

      <article className="admin-form-card"><form onSubmit={submitRam}><section className="admin-form-section"><h2>RAM × Placa-mãe / QVL</h2><div className="admin-form-grid">
        <div className="admin-field"><label>Placa-mãe</label><select className="admin-select" required value={ram.placaMaeId} onChange={(e)=>setRam((c)=>({...c,placaMaeId:e.target.value}))}><option value="">Selecione</option>{boards.map((item)=><option key={item.id} value={item.id}>{item.nome}</option>)}</select></div>
        <div className="admin-field"><label>Memória RAM</label><select className="admin-select" required value={ram.memoriaRamId} onChange={(e)=>setRam((c)=>({...c,memoriaRamId:e.target.value}))}><option value="">Selecione</option>{rams.map((item)=><option key={item.id} value={item.id}>{item.nome}</option>)}</select></div>
        <div className="admin-field"><label>BIOS testada</label><input className="admin-input" value={ram.biosTestada} onChange={(e)=>setRam((c)=>({...c,biosTestada:e.target.value}))}/></div>
        <div className="admin-field"><label>Família CPU testada</label><input className="admin-input" value={ram.familiaProcessadorTestada} onChange={(e)=>setRam((c)=>({...c,familiaProcessadorTestada:e.target.value}))}/></div>
        <div className="admin-field"><label>Frequência validada (MHz)</label><input className="admin-input" type="number" min="1" value={ram.frequenciaValidadaMhz} onChange={(e)=>setRam((c)=>({...c,frequenciaValidadaMhz:e.target.value}))}/></div>
        <div className="admin-field"><label>Módulos testados</label><input className="admin-input" type="number" min="1" value={ram.quantidadeModulosTestados} onChange={(e)=>setRam((c)=>({...c,quantidadeModulosTestados:e.target.value}))}/></div>
        <div className="admin-field"><label>Capacidade total testada (GB)</label><input className="admin-input" type="number" min="1" value={ram.capacidadeTotalTestadaGb} onChange={(e)=>setRam((c)=>({...c,capacidadeTotalTestadaGb:e.target.value}))}/></div>
        <div className="admin-field"><label>Verificado em</label><input className="admin-input" type="date" value={ram.verificadoEm} onChange={(e)=>setRam((c)=>({...c,verificadoEm:e.target.value}))}/></div>
        <div className="admin-field admin-field--boolean"><label className="admin-switch"><input type="checkbox" checked={ram.compativel} onChange={(e)=>setRam((c)=>({...c,compativel:e.target.checked}))}/> Compatível</label></div>
        <div className="admin-field admin-field--boolean"><label className="admin-switch"><input type="checkbox" checked={ram.constaNaQvl} onChange={(e)=>setRam((c)=>({...c,constaNaQvl:e.target.checked}))}/> Consta na QVL</label></div>
        <div className="admin-field full"><label>Fonte da informação</label><input className="admin-input" type="url" value={ram.fonteUrl} onChange={(e)=>setRam((c)=>({...c,fonteUrl:e.target.value}))}/></div>
        <div className="admin-field full"><label>Observação</label><textarea className="admin-textarea" value={ram.observacao} onChange={(e)=>setRam((c)=>({...c,observacao:e.target.value}))}/></div>
      </div></section><footer className="admin-form-footer"><button className="btn btn-primario" disabled={saving==='ram'}>{saving==='ram'?'Salvando...':'Cadastrar QVL'}</button></footer></form></article>
    </section>}

    <section className="admin-card" style={{marginTop:18}}><header className="admin-card-header"><div><h2>CPU × Placa-mãe</h2><p>{cpuItems.length} relação(ões) cadastrada(s).</p></div></header><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Placa-mãe</th><th>Processador</th><th>BIOS</th><th>Resultado</th><th>Verificação</th></tr></thead><tbody>{cpuItems.length?cpuItems.map((item)=><tr key={item.id}><td>{item.placaMae?.nome||`#${item.placaMaeId}`}</td><td>{item.processador?.nome||`#${item.processadorId}`}</td><td>{item.biosMinima||'—'}</td><td><span className={`admin-status ${item.compativel?'status-ativo':'status-inativo'}`}>{item.compativel?'COMPATÍVEL':'INCOMPATÍVEL'}</span></td><td>{formatDate(item.verificadoEm||item.atualizadoEm)}</td></tr>):<EmptyRow columns={5}/>}</tbody></table></div></section>

    <section className="admin-card" style={{marginTop:18}}><header className="admin-card-header"><div><h2>RAM × Placa-mãe / QVL</h2><p>{ramItems.length} relação(ões) cadastrada(s).</p></div></header><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Placa-mãe</th><th>Memória</th><th>Frequência</th><th>QVL</th><th>Resultado</th><th>Verificação</th></tr></thead><tbody>{ramItems.length?ramItems.map((item)=><tr key={item.id}><td>{item.placaMae?.nome||`#${item.placaMaeId}`}</td><td>{item.memoriaRam?.nome||`#${item.memoriaRamId}`}</td><td>{item.frequenciaValidadaMhz?`${item.frequenciaValidadaMhz} MHz`:'—'}</td><td>{item.constaNaQvl?'Sim':'Não'}</td><td><span className={`admin-status ${item.compativel?'status-ativo':'status-inativo'}`}>{item.compativel?'COMPATÍVEL':'INCOMPATÍVEL'}</span></td><td>{formatDate(item.verificadoEm||item.atualizadoEm)}</td></tr>):<EmptyRow columns={6}/>}</tbody></table></div></section>
  </>
}
