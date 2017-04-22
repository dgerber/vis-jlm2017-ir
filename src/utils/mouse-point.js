
export default function d3_mousePoint(container, e) {
  if (e.changedTouches) e = e.changedTouches[0]
  var svg = container.ownerSVGElement || container
  if (svg.createSVGPoint) {
    var point = svg.createSVGPoint()
    point.x = e.clientX, point.y = e.clientY
    point = point.matrixTransform(container.getScreenCTM().inverse())
    return [point.x, point.y]
  } else {
    var rect = container.getBoundingClientRect()
    return [e.clientX - rect.left - container.clientLeft,
            e.clientY - rect.top - container.clientTop]
  }
}
