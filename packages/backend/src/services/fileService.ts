import JSZip from 'jszip'
import { Builder, Parser } from 'xml2js'
import { Node } from '../types/index.js'

interface Edge {
  id: string
  source: string
  target: string
}

interface GraphData {
  nodes: Node[]
  edges: Edge[]
  name: string
}

/**
 * 保存图谱为 .oml 文件（ZIP 格式）
 * 返回 base64 编码的 ZIP 数据
 */
export async function saveOmlFile(graphData: GraphData): Promise<string> {
  const zip = new JSZip()

  // 1. 生成 structure.xml
  const structureXml = generateStructureXml(graphData)
  zip.file('structure.xml', structureXml)

  // 2. 创建 nodes 目录并添加节点文件
  const nodesFolder = zip.folder('nodes')
  if (nodesFolder) {
    graphData.nodes.forEach(node => {
      nodesFolder.file(`${node.id}.md`, node.content)
    })
  }

  // 3. 创建空的 resources 目录
  zip.folder('resources')

  // 4. 生成 ZIP 并返回 base64
  const zipBlob = await zip.generateAsync({ type: 'base64' })
  return zipBlob
}

/**
 * 加载 .oml 文件（从 base64 编码的 ZIP）
 */
export async function loadOmlFile(base64Data: string): Promise<GraphData> {
  // 1. 解压 ZIP
  const zip = await JSZip.loadAsync(base64Data, { base64: true })

  // 2. 读取 structure.xml
  const structureFile = zip.file('structure.xml')
  if (!structureFile) {
    throw new Error('Invalid .oml file: structure.xml not found')
  }

  const xmlContent = await structureFile.async('string')
  const structure = await parseStructureXml(xmlContent)

  // 3. 读取所有节点文件
  const nodes: Node[] = await Promise.all(
    structure.nodes.map(async (nodeInfo: any) => {
      const nodeFile = zip.file(`nodes/${nodeInfo.id}.md`)
      if (!nodeFile) {
        throw new Error(`Node file not found: ${nodeInfo.id}.md`)
      }

      const content = await nodeFile.async('string')
      return {
        id: nodeInfo.id,
        content,
        position: nodeInfo.position,
        parentIds: nodeInfo.parentIds || [],
        createdAt: nodeInfo.createdAt
      }
    })
  )

  return {
    nodes,
    edges: structure.edges || [],
    name: structure.name || 'Untitled'
  }
}

/**
 * 生成 structure.xml
 */
function generateStructureXml(graphData: GraphData): string {
  const builder = new Builder({
    xmldec: { version: '1.0', encoding: 'UTF-8' }
  })

  const xmlObject = {
    graph: {
      metadata: {
        name: graphData.name,
        createdAt: new Date().toISOString()
      },
      nodes: {
        node: graphData.nodes.map(node => ({
          $: {
            id: node.id,
            x: node.position.x.toString(),
            y: node.position.y.toString()
          },
          parentIds: node.parentIds.length > 0 ? {
            parent: node.parentIds
          } : undefined,
          createdAt: node.createdAt
        }))
      },
      edges: graphData.edges.length > 0 ? {
        edge: graphData.edges.map(edge => ({
          $: {
            id: edge.id,
            source: edge.source,
            target: edge.target
          }
        }))
      } : undefined
    }
  }

  return builder.buildObject(xmlObject)
}

/**
 * 解析 structure.xml
 */
async function parseStructureXml(xmlContent: string): Promise<any> {
  const parser = new Parser()
  const result = await parser.parseStringPromise(xmlContent)

  const graph = result.graph
  const nodes = Array.isArray(graph.nodes?.[0]?.node)
    ? graph.nodes[0].node
    : graph.nodes?.[0]?.node
    ? [graph.nodes[0].node]
    : []

  const edges = graph.edges?.[0]?.edge
    ? Array.isArray(graph.edges[0].edge)
      ? graph.edges[0].edge
      : [graph.edges[0].edge]
    : []

  return {
    name: graph.metadata?.[0]?.name?.[0] || 'Untitled',
    nodes: nodes.map((node: any) => ({
      id: node.$.id,
      position: {
        x: parseFloat(node.$.x),
        y: parseFloat(node.$.y)
      },
      parentIds: node.parentIds?.[0]?.parent || [],
      createdAt: node.createdAt?.[0] || new Date().toISOString()
    })),
    edges: edges.map((edge: any) => ({
      id: edge.$.id,
      source: edge.$.source,
      target: edge.$.target
    }))
  }
}

