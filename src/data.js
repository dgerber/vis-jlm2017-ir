import Simulation from './data/simulation/Simulation'
import JLMSimulation from './data/simulation/JLMSimulation'

import UserParams from './data/simulation/UserParams'
import IRParams from './data/simulation/IRParams'

import DistributionRevenus from './data/DistributionRevenus'

import { bisectLeft, pairs } from 'd3-array'


const REVENU_MAX = 1e6
DistributionRevenus.bareme.unshift({ revenu: 0, percentile: 100 })
DistributionRevenus.bareme.push({ revenu: REVENU_MAX, percentile: 0 })
const binsRevenus = pairs(DistributionRevenus.bareme, (a,b) => ({
  a, b,
  x0: a.revenu, x1: b.revenu,
  pct: a.percentile - b.percentile,
  isCap: b.revenu === REVENU_MAX
}))
export { DistributionRevenus, binsRevenus }

export const COUPLES = [0,1],
      ENFANTS = [0,1,2,3,4,5,6,7,8,9],
      SOURCES = ['current', 'revolution'],
      TYPES = ['IR', 'CSG', 'total']


export function init(revenus){
  const series = []
  for (const couple of COUPLES){
    for (const enfants of ENFANTS){
      for (const source of SOURCES){
          series.push({ couple, enfants, source, montants: [] })
      }
    }
  }

  const cache = new Map
  function get(revenu, couple, enfants){
    revenu = Math.round(Math.abs(revenu))
    const key = revenu+'-'+couple+'-'+enfants
    if (!cache.has(key)){
      const v = generateSeries(revenu,0,0,couple,enfants),
            vref = enfants>0 ? get(revenu, couple, 0) : null
      for (const source of SOURCES){
        const s = v[source]
        s.mensuel = s.total / 12
        s.reste = revenu - s.mensuel
        s.creditEnfants = vref ? vref[source].mensuel - s.mensuel : 0
      }
      cache.set(key, v)
    }
    return cache.get(key)
  }

  revenus = revenus// || [0, 1e3, 2e3, 3e3, 4e3]
  revenus.forEach(insertVal)

  return { revenus, series, get, insertVal }

  function insertVal(revenu){
    const pos = bisectLeft(revenus, revenu)
    if (revenus[pos+1] != revenu) {   // ignore dups
      let i = 0
      revenus.splice(pos, 1, revenu)
      for (const couple of COUPLES){
        for (const enfants of ENFANTS){
          const v = get(revenu,couple,enfants)
          for (const source of SOURCES){
            series[i++].montants.splice(pos, 1, v[source])
          }
        }
      }
    }
  }
}


// SimuStore.generateSeries
export function generateSeries(net, retraite, chomage, couple, nbEnfants) {
  const userParams = UserParams(net, retraite, chomage, couple, nbEnfants)
  const irParams = IRParams(userParams)

  const simulation = Simulation(irParams.revenu.fiscalDeReference, userParams.nbPartsFiscales.value, couple, irParams.csg.taux.plein.salarie, irParams.csg.taux.reduit.salarie)

  const newRFR = {
    "salarie": net,
    "chomeur": chomage,
    "retraite": retraite
  }

  const jlmSimulation = JLMSimulation(newRFR, couple, nbEnfants)

  const IR = Math.round(simulation.impot.du.value  * 12),
        CSG = Math.round(simulation.csg.du.value  * 12),
        NEW_IR = Math.round(jlmSimulation.ir * 12),
        CSG_P = Math.round(jlmSimulation.csg * 12);

  return {
    current: {
      IR: IR,
      CSG: CSG,
      total: IR + CSG
    },
    revolution: {
      IR: NEW_IR,
      CSG: CSG_P,
      total: NEW_IR + CSG_P
    },
    gain: (IR + CSG) - (NEW_IR + CSG_P),
    developer: jlmSimulation.calcul
  };
}
