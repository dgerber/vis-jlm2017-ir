<template>
  <div id="app">

    <svg :width="W" :viewBox="[-W*.04,-H*.04,W*1.08,H*1.12]" overflow="visible">
      <rect class="viewport" :width="W" :height="H"
            @click="onclick" @mousemove="onmove"/>

      <text class="meta" :transform="'translate('+[W,H]+')translate(-8,40)'"
            text-anchor="end">
        <tspan>Source de données:
          <a xlink:href="https://impots.jlm2017.fr">impots.jlm2017.fr</a>
        </tspan>
        <tspan dx="1em">Ébauche graphique v0.1:
          <a xlink:href="https://github.com/dgerber/vis-jlm2017-ir">dgerber</a>
        </tspan>
      </text>

      <!-- <g :transform="'translate('+e.translate+')scale('+e.scale+')'"></g> -->

      <g class="axes">
        <g :transform="'translate(0,'+H+')'">
          <text y="40">Revenu imposable (€/mois)</text>
        </g>
        <g :transform="'translate('+[W,H]+') rotate(-90)'">
          <text y="30">{{ creditEnfants ? "Crédit d'impôt effectif pour enfants à charge" : "Revenu disponible après impôts" }} (€/mois)</text>
        </g>
        <g transform="rotate(90)">
          <text y="20">Distribution des contribuables</text>
        </g>
      </g>

      <g class="histRevenus">
        <rect v-for="bin in bins"
              :transform="'translate('+[xScale(bin.cx0), 0]+')'"
              :width="bin.w-1"
              :height="bin.pct / bin.w *H*.8"
              ></rect>
      </g>

      <g class="series">
        <path :d="lineGenId(revenus)" class="identity" title="Revenu imposable"></path>
        <g v-for="s in series" v-show="!isHidden(s)"
           :class="['couple'+s.couple,'enfants-'+s.enfants, 'source-'+s.source]"
           :title="[s.couple, s.enfants,s.source].join('-')">
          <path :d="lineGenSeries(s.montants)"
                :stroke-dasharray="dasharrayEnfants(s.enfants)">
          </path>
        </g>
      </g>

      <g class="detail" v-if="detail.value >= 0"
         :transform="'translate('+[xScale(detail.value),0]+')'">
        <line :y1="y.range[0]" :y2="y.range[1]"></line>
        <text text-anchor="middle" :y="H+20">
          {{detail.value}}€
        </text>
        <g v-for="s in detailData" v-if="!isHidden(s)"
           :transform="'translate('+[0,s.y]+')'"
           :class="['couple'+s.couple,'enfants-'+s.enfants, 'source-'+s.source]">
          <circle r="4"></circle>
          <text :text-anchor="s.left ? 'end' : 'start'"
                :x="s.left ? '-8' : '8'" y=".3em">
             {{Math.round(s.detailValue)}}€
          </text>
          <!-- {{ s.reste }}€ = {{detail.value}} - {{s.mensuel}} (IR:{{s.IR/12}} + CSG:{{s.CSG/12}}) -->
        </g>
      </g>

    </svg>

    <!-- <span style="font-size: small">Données: Code source: </span> -->

    <form>
      <select v-model.number="filtre.couple">
        <option value="0">Imposition individuelle</option>
        <option value="1">Couple</option>
      </select>

      <select v-model.number="filtre.enfants" multiple>
        <option v-for="n in ENFANTS" :value="n">{{ n }} enfants</option>
      </select>

      <select v-model="x.variante">
        <option value="linrev">∝ revenu imposable</option>
        <option value="uniform">∝ distribution contribuables</option>
      </select>

      <select v-model.number="creditEnfants">
        <option :value="false">Revenu après impôt</option>
        <option :value="true">Crédit pour enfants</option>
      </select>
    </form>

  </div>
</template>

<script>
import * as data from './data'
import scale from './utils/make-scale'
import mousePoint from './utils/mouse-point'

import * as d3Shape from 'd3-shape'
import * as d3Scale from 'd3-scale'
import * as d3Array from 'd3-array'
const d3 = { ...d3Scale, ...d3Shape, ...d3Array }

const W = 800, H = 600
export default {
  name: 'app',
  data () {
    const xMin = 0, xMax = 9000
    return {
      W, H, ...data, ...data.init(d3.ticks(xMin, xMax, 20)),
      x: { domain: [xMin, xMax], range: [0,W],
           type: 'linear', variante: 'uniform' },
      y: { domain: [xMin, xMax], range: [H,0], type: 'linear' },
      filtre: { couple: 0, enfants: [0,4] },
      creditEnfants: false,
      detail: { value: 1300, lock: false}
    }
  },
  computed: {
    xScale (){ this.rescaleX(); return scale(this.x) },
    yScale (){ return scale(this.y) },
    lineGenId (){
      return d3.line() .x(this.xScale) .y(this.yScale)
    },
    valueAcc(){
      if (this.creditEnfants){
        return (_, i) => _.creditEnfants
      } else {
        const xv = this.revenus
        return (_, i) => _.reste
      }
    },
    lineGenSeries (){
      const xs = this.xScale, xv = this.revenus, ys = this.yScale, va = this.valueAcc
      return d3.line() .x((_, i) => xs(xv[i])) .y((_, i) => ys(va(_,i)))
    },
    detailData(){
      return this.series.map(function(s){
        const d =  this.get(this.detail.value, s.couple, s.enfants)[s.source],
              detailValue = this.valueAcc(d)
        return {
            ...s, ...d, detailValue,
          y: this.yScale(detailValue),
          left: s.source=='revolution'
        }
      }, this)
    },
    fcouple(){
      return this.filtre.couple ? 2 : 1
    },
    bins(){
      const c = this.fcouple
      return this.binsRevenus.map(function(b){
        b.cx0 = c*b.x0, b.cx1 = c*b.x1
        b.w = this.xScale(b.cx1) - this.xScale(b.cx0)
        return b
      }, this)
    }
  },
  watch: { },
  methods: {
    isHidden (s){
      const f = this.filtre
      return f.couple != s.couple || f.enfants.indexOf(s.enfants) == -1
    },
    dasharrayEnfants (n){
      const L = 24
      return n ? L + ' 6 ' + (new Array(n)).fill(2).join(' 2 ') + ' 6' : ''
      // return n ? (new Array(n)).fill(L/n).join(' 2 ') + ' 2 ' : ''
    },
    rescaleX (){
      const x = this.x
      if (x.variante == 'linrev'){
        const r = this.revenus
        x.domain = [r[0], r[r.length-1]]
        x.range = [0,W]
      } else {
        const hist = this.DistributionRevenus.bareme,
              c = this.fcouple
        x.domain = hist.map(_ => c * _.revenu)
        x.range = hist.map(_ => (1-_.percentile*.01)*W)
      }
    },
    onclick (event){
      this.detail.lock = !this.detail.lock
      this.onmove(event)
    },
    onmove (event){
      if (!this.detail.lock){
        const p = mousePoint(event.target, event)
        this.detail.value = Math.round(this.xScale.invert(p[0]))
      }
    }
  },
  components: { }
}

</script>

<style scoped>
rect.viewport { fill: none; stroke: grey; pointer-events: all; }
svg .detail * /* *:not(.viewport):not(.meta) */ { pointer-events: none; }

path { fill: none; stroke: black; }
path.identity { stroke: grey; stroke-width: 1px;  }

.histRevenus rect { fill: grey; opacity: .2; stroke: none; }
.series path { stroke-width: 3px; }

.source-current > * { stroke: rgb(91, 192, 222); }
.source-revolution > * { stroke: rgb(201, 70, 44); }
.type-IR, .type-CSG { display: none; }

.detail circle, .detail line { fill: none; opacity: .9; }
.detail circle { stroke-width: 4px; }
.detail line { stroke: grey; stroke-width: 4px; opacity: .4; }

.axes { stroke: grey; opacity: .6; font-size: smaller; }
.meta { stroke: grey; opacity: .6; font-size: xx-small; font-style: italic; }

#app {
  font-family: 'Avenir', Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 20px;
}
</style>
