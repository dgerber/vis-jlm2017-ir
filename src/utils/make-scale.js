import * as d3 from 'd3-scale'

export default function make_scale({ type='linear', domain=[0,1], range=[0,1] }={}){
  if (type == 'linear') {
    return d3.scaleLinear() .domain(domain) .range(range) .nice()
  } else {
    throw 'NotImplemented'
  }
}
