import router from './router'
import { COMMON_ERROR_RES } from './utils/const'
import PostmanService from '../service/export/postman'
import MarkdownService from '../service/export/markdown'
// import PDFService from '../service/export/pdf'
import * as moment from 'moment'
import DocxService from '../service/export/docx'
import { AccessUtils, ACCESS_TYPE } from './utils/access'
import {Interface, Module, Property, QueryInclude, Repository} from '../models/'
import Tree from "./utils/tree"

const generateModulePlugin = (protocol: any, host: any,rpoName:string, module: Module) => {
  function parseItemType(item: any) {
    let append = item.required ? '' : '?'
    let name = toCamelUpperCase(item.name) + append
    switch (item.type) {
      case 'String':
      case 'Date':
        return `${name}: string`
      case 'Number':
      case 'Long':
      case 'Double':
        return `${name}: number`
      case 'Boolean':
        return `${name}: boolean`
      case 'Function':
      case 'RegExp':
        return `${name}: never`
      case 'Object':
        if (item.children) {
          return `${name}:{
             ${item.children.map((child: any) => {return parseItemType(child)}).join('\n          ')}
          }`
        } else {
          return `${name}: any`
        }
      case 'Array':
        if (item.children) {
          return `${name}:[{
             ${item.children.map((child: any) => {return parseItemType(child)}).join('\n          ')}
             }]`
        } else {
          return `${name}: any[]`
        }
      case 'Null':
        return `${name}: null`
      default:
        return ``
    }
  }
  // DONE 2.3 protocol 错误，应该是 https
  let editor = `${protocol}://rap2.devops.foxhis.com/repository/editor?id=${module.repositoryId}&mod=${module.id}` // [TODO] replaced by cur domain
  let moduleName = module.urlName ? module.urlName : "module" + module.id
  let result = `
/**
 * 仓库    RepositoryId:${module.repositoryId} 模块 #${module.id} ${module.name}
 * 在线编辑 ${editor}
 * 仓库数据 ${protocol}://${host}/repository/get?id=${module.repositoryId}
 */

  export namespace ${moduleName}{
    export const apis = {
    ${module.interfaces.map((itf: Interface) =>
      `${itf.urlName}:{ server:'${rpoName}', id: ${itf.id}, name: '${itf.name}', method: '${itf.method}', path: '${itf.url}'}`
    ).join(',\n      ')}
    }
  
    ${module.interfaces.map((itf: Interface) =>{
      let result = ``;
      if(itf.request.children.length>0){
        result= result +`export interface ${toCamelUpperCase(itf.urlName)}Request extends BaseRequest{
      ${itf.request.children.map((child: any) => parseItemType(child)).join('\n  ')}
    }\n    `
      }else{
        result= result +(`export type ${toCamelUpperCase(itf.urlName)}Request = BaseRequest\n  `)
      }
        if(itf.response.children.length>0){
          result= result +(`export interface ${toCamelUpperCase(itf.urlName)}Response extends BaseResponse{
      ${itf.response.children.map((child: any) => parseItemType(child)).join('\n  ')}
    }`)
        }else{
          result= result +(`export type ${toCamelUpperCase(itf.urlName)}Response = BaseResponse\n  `)
        }
        return result
  }

  ).join('\n    ')}
    export interface ${moduleName}APISchema extends APISchema {
    ${module.interfaces.map((itf: Interface) =>
      `    ${itf.urlName}:{ request: ${itf.urlName}Request,response: ${itf.urlName}Response }`
  ).join('\n    ')}
    }
  }
`
  return result
}
const toCamelUpperCase = (str: string) => {
  const reg = /(_|-)(\w)/g
  if(str.includes("_")||str.includes("-")){
    return str.replace(reg, function (_a, _b,c) {
      return c.toUpperCase()
    })
  }else{
    return str
  }
}

router.get('/export/postman', async ctx => {
  const repoId = +ctx.query.id
  if (
    !(await AccessUtils.canUserAccess(
      ACCESS_TYPE.REPOSITORY_GET,
      ctx.session.id,
      repoId
    ))
  ) {
    ctx.body = COMMON_ERROR_RES.ACCESS_DENY
    return
  }
  if (!(repoId > 0)) {
    ctx.data = COMMON_ERROR_RES.ERROR_PARAMS
  }
  const repository = await Repository.findByPk(repoId)
  ctx.body = await PostmanService.export(repoId)
  ctx.set(
    'Content-Disposition',
    `attachment; filename="RAP-${encodeURI(
      repository.name
    )}-${repoId}-${encodeURI('POSTMAN')}-${moment().format('YYYYMMDDHHmmss')}.json"`
  )
  ctx.set(
    'Content-type',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  )
})

router.get('/export/markdown', async ctx => {
  const repoId = +ctx.query.id
  if (
    !(await AccessUtils.canUserAccess(
      ACCESS_TYPE.REPOSITORY_GET,
      ctx.session.id,
      repoId
    ))
  ) {
    ctx.body = COMMON_ERROR_RES.ACCESS_DENY
    return
  }
  if (!(repoId > 0)) {
    ctx.data = COMMON_ERROR_RES.ERROR_PARAMS
  }
  ctx.body = await MarkdownService.export(repoId, ctx.query.origin as string)
})

router.get('/export/docx', async ctx => {
  const repoId = +ctx.query.id
  if (
    !(await AccessUtils.canUserAccess(
      ACCESS_TYPE.REPOSITORY_GET,
      ctx.session.id,
      repoId
    ))
  ) {
    ctx.body = COMMON_ERROR_RES.ACCESS_DENY
    return
  }
  if (!(repoId > 0)) {
    ctx.data = COMMON_ERROR_RES.ERROR_PARAMS
  }
  const repository = await Repository.findByPk(repoId)
  ctx.body = await DocxService.export(repoId, ctx.query.origin as string)
  ctx.set(
    'Content-Disposition',
    `attachment; filename="RAP-${encodeURI(
      repository.name
    )}-${repoId}-${encodeURI('接口文档')}-${moment().format('YYYYMMDDHHmmss')}.docx"`
  )
  ctx.set(
    'Content-type',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  )
})
router.get('/export/interface', async (ctx) => {
  const repoId = +ctx.query.id
  const token = (<string>ctx.query.token)
  if (
      !(await AccessUtils.canUserAccess(
          ACCESS_TYPE.REPOSITORY_GET,
          ctx.session.id,
          repoId,
          token
      ))
  ) {
    ctx.body = COMMON_ERROR_RES.ACCESS_DENY
    return
  }
  if (!(repoId > 0)) {
    ctx.data = COMMON_ERROR_RES.ERROR_PARAMS
  }
  const repository = await Repository.findByPk(repoId)
  const moduleId = ctx.query.mod
  let modules = [];
  if(moduleId){
    let moduleIds = new Set<number>((<string>moduleId).split(',').map((item: string) => +item).filter((item: any) => item)) // _.uniq() => Set
    for (let id of moduleIds){
      let module = await Module.findByPk(id, {
        attributes: { exclude: [] },
      } as any)
      if (!module) continue
      module.interfaces = await Interface.findAll<Interface>({
        attributes: { exclude: [] },
        where: {
          repositoryId: module.repositoryId,
          moduleId: module.id
        },
        include: [
          QueryInclude.Properties,
        ],
      } as any)
      modules.push(module);
    }

  }else{
    const repo = await Repository.findByPk(repoId, {
      include: [
        {
          model: Module,
          as: 'modules',
          include: [
            {
              model: Interface,
              as: 'interfaces',
              include: [
                {
                  model: Property,
                  as: 'properties'
                }
              ]
            }
          ]
        }
      ]
    })
    if(repo){
      modules = repo.modules
    }
  }
  let result = []
  let baseResult = `
interface BaseRequest extends Record<string, any> {
    groupid:string,
    hotelid?:string,
    username:string,
    role?:string
}

interface BaseResponse extends Record<string, any> {
    errorCode:string | '0',
    errorMessage?:string,
}

type APISchema = Record<string, {
    request: BaseRequest | void;
    response: BaseResponse | any;
}>;
  `
  result.push(baseResult)
  for (let module of modules) {
    if (module.url) {
      module.urlName = toCamelUpperCase(module.url.substr(1))
    }
    module.interfaces.forEach(itf => {
      itf.urlName = toCamelUpperCase(itf.url.substr(itf.url.lastIndexOf('/') + 1))
      itf.request = Tree.ArrayToTree(itf.properties.filter(item => item.scope === 'request'))
      itf.response = Tree.ArrayToTree(itf.properties.filter(item => item.scope === 'response'))
    })
    // 修复 协议总是 http
    // https://lark.alipay.com/login-session/unity-login/xp92ap
    let protocol = ctx.headers['x-client-scheme'] || ctx.protocol
    result.push(generateModulePlugin(protocol, ctx.host,repository.name, module))
  }
  ctx.set(
      'Content-Disposition',
      `attachment; filename="RAP-${encodeURI(
          repository.name
      )}-${repoId}-${moduleId}.ts"`
  )
  ctx.type = 'application/javascript; charset=utf-8'
  ctx.body = result.join('\n')
})

// router.get('/export/pdf', async ctx => {
//   const repoId = +ctx.query.id
//   if (
//     !(await AccessUtils.canUserAccess(
//       ACCESS_TYPE.REPOSITORY,
//       ctx.session.id,
//       repoId
//     ))
//   ) {
//     ctx.body = COMMON_ERROR_RES.ACCESS_DENY
//     return
//   }
//   if (!(repoId > 0)) {
//     ctx.data = COMMON_ERROR_RES.ERROR_PARAMS
//   }
//   const repository = await Repository.findByPk(repoId)
//   ctx.body = await PDFService.export(repoId, ctx.query.origin)
//   ctx.set(
//     'Content-Disposition',
//     `attachment; filename="RAP-${encodeURI(
//       repository.name
//     )}-${repoId}-${encodeURI('接口文档')}.pdf"`
//   )
//   ctx.set(
//     'Content-type',
//     'application/pdf'
//   )
// })
