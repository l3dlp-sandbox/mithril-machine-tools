export default v => {
  // Internal
  let root   // Nearest ancestral mount-point
  let rootVs // Root vnodes as of last check
  let host   // v's vnode sequence
  let path   // v's position within container

  // Flag passed to view to indicate current draw loop is local
  let local = false

  return {
    view: () =>
      v.children[0].children({local, redraw}),

    oncreate: tick,
    onupdate: tick,
  }

  // Update internal reference, clear local flag
  function tick(x){
    v = x

    Promise.resolve().then(() => {
      local = false
    })
  }

  // Overload redraw function
  function redraw(handler){
    // Manual, explicit redraw
    if(typeof x !== 'function')
      render()

    // Event handler wrapper: inverts Mithril auto-redraw directives:
    else
      return function(e){
        const output = handler(...arguments)

        // Unless e.redraw was set to false, redraw
        if(e.redraw !== false)
          render()

        // Prevent global redraw
        e.redraw = false

        return output
      }
  }

  function render(){
    if(!v.dom || !v.dom.parentNode)
      return

    if(!root)
      root = findRoot(v.dom)

    local = true

    // If a global redraw took place since last local draw,
    // we might need to relocate the island's global position
    if(rootVs !== root.vnodes){
      ({host, path} = findWithinRoot(v, root))
      rootVs        = root.vnodes
    }

    const vnodes = Array.isArray(host) ? host : [host]
    const patch  = path.reverse().slice(1).reduce(
      (patch, key) => ({
        [key] : O(patch)
      }),
      {
        [path[0]] : m(v.tag, v.attrs, v.children)
      },
    )
    const replacement = O(vnodes, patch)

    // Set a local vnodes modulo to allow Mithril to skip siblings
    // and diff from last global draw
    v.dom.parentNode.vnodes = vnodes

    // Render the patched local container + our new local draw
    m.render(v.dom.parentNode, replacement)

    // Persist the vnode patch to Mithril's global vtree cache
    // (for global draw diffing)
    host[path[0]] = replacement[path[0]]
  }
}

const findRoot = element => {
  while(!element.vnodes)
    element = element.parentNode

  return element
}

const findWithinRoot = (target, root) => {
  const path = []
  let host

  for(const {node, key, container} of crawl({node: root.vnodes})){
    if(node.dom === target.dom){
      path.push(key)

      if(!host)
        host = container
    }

    if(node === target)
      return {path, host}
  }
}

function * crawl({key, node, container}){
  yield {key, node, container}

  if(Array.isArray(node))
    for(var key = 0; key < node.length; key++)
      yield * recurse()

  else
    for(var key of ['instance', 'children'])
      if(node[key])
        return yield * recurse()

  function recurse(){
    return crawl({
      key,
      node: node[key],
      container: node,
    })
  }
}
