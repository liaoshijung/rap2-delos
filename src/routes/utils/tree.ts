import { Property } from '../../models'
import * as _ from 'underscore'
import * as Mock from 'mockjs'

const { RE_KEY } = require('mockjs/src/mock/constant')
const vm = require('vm');

export default class Tree {
  public static ArrayToTree(list: Property[]) {
    let result: any = {
      name: 'root',
      children: [],
      depth: 0,
    }

    let mapped: any = {}
    list.forEach(item => {
      mapped[item.id] = item
    })

    function _parseChildren(parentId: any, children: any, depth: any) {
      for (let id in mapped) {
        let item = mapped[id]
        if (typeof parentId === 'function' ? parentId(item.parentId) : item.parentId === parentId) {
          children.push(item)
          item.depth = depth + 1
          item.children = _parseChildren(item.id, [], item.depth)
        }
      }
      return children
    }

    _parseChildren(
      (parentId: number) => {
        // 忽略 parentId 为 0 的根属性（历史遗留），现为 -1
        if (parentId === -1) return true
        return false
      },
      result.children,
      result.depth,
    )

    return result
  }

  public static TreeToSchema(tree: any) {
    function parse(item: any, result: any) {
      let required = item.required
      let append = required !== '1' ? '?' : ''
      switch (item.type) {
        case 'String':
        case 'Date':
          result[item.name + append] = 'string'
          break
        case 'Number':
        case 'Long':
        case 'Double':
          result[item.name + append] = 'number'
          break
        case 'Boolean':
          result[item.name + append] = 'boolean'
          break
        case 'Function':
        case 'RegExp':
          result[item.name + append] = 'never'
          break
        case 'Object':
          if (item.children) {
            result[item.name] = {}
            item.children.forEach((child: any) => {
              parse(child, result[item.name])
            })
          } else {
            result[item.name + append] = 'any'
          }
              break
        case 'Array':
          result[item.name] = item.children.length ? [{}] : 'any[]'
          item.children.forEach((child: any) => {
            parse(child, result[item.name][0])
          })
          break
        case 'Null':
          // tslint:disable-next-line: no-null-keyword
          result[item.name + append] = null
          break
      }
    }
    let result = {}
    tree.children.forEach((child: any) => {
      parse(child, result)
    })
    return result
  }

  // TODO 2.x 和前端重复了
  public static TreeToTemplate(tree: any) {
    function parse(item: any, result: any) {
      let rule = item.rule ? '|' + item.rule : ''
      let value = item.value
      if (
        item.value &&
        item.value.indexOf('[') === 0 &&
        item.value.substring(item.value.length - 1) === ']' &&
        !!rule
      ) {
        try {
          result[item.name + rule] = vm.runInContext(`(${item.value})`)
        } catch (e:any) {
          result[item.name + rule] = item.value
        }
      } else {
        switch (item.type) {
          case 'String':
            result[item.name + rule] = item.value
            break
          case 'Number':
            if (value === '') value = 1
            let parsed = parseInt(value)
            if (!isNaN(parsed)) value = parsed
            result[item.name + rule] = value
            break
          case 'Long':
            if (value === '') value = 1
            let longParsed = parseFloat(value)
            if (!isNaN(longParsed)) value = longParsed
            result[item.name + rule] = value
            break
          case 'Date':
            let date = new Date()
            let fmt = rule
            if (rule === '') fmt = 'yyyy-MM-dd hh:mm:ss'
            if (/(y+)/.test(fmt)) {
              fmt = fmt.replace(RegExp.$1, (String(date.getFullYear())).substring(4 - RegExp.$1.length))
            }
            let o = {
              'M+': date.getMonth() + 1,
              'd+': date.getDate(),
              'h+': date.getHours(),
              'm+': date.getMinutes(),
              's+': date.getSeconds()
            }
            for (let k in o) {
              if (new RegExp(`(${k})`).test(fmt)) {
                let str = String(o[k])
                fmt = fmt.replace(RegExp.$1, RegExp.$1.length === 1 ? str : ('00' + str).substr(str.length))
              }
            }
            result[item.name + rule] = fmt
            break
          case 'Double':
            if (value === '') value = 1.00
            let floatParsed = parseFloat(value)
            if (!isNaN(floatParsed)) value = floatParsed
            result[item.name + rule] = value
            break
          case 'Boolean':
            if (value === 'true') value = true
            if (value === 'false') value = false
            if (value === '0') value = false
            value = !!value
            result[item.name + rule] = value
            break
          case 'Function':
          case 'RegExp':
            try {
              result[item.name + rule] = vm.runInContext('(' + item.value + ')')
            } catch (e:any) {
              console.warn(
                `TreeToTemplate ${e.message}: ${item.type} { ${item.name}${rule}: ${item.value} }`,
              ) // TODO 2.2 怎么消除异常值？
              result[item.name + rule] = item.value
            }
            break
          case 'Object':
            if (item.value) {
              try {
                result[item.name + rule] = vm.runInContext(`(${item.value})`)
              } catch (e:any) {
                result[item.name + rule] = item.value
              }
            } else {
              result[item.name + rule] = {}
              item.children.forEach((child: any) => {
                parse(child, result[item.name + rule])
              })
            }
            break
          case 'Array':
            if (item.value) {
              try {
                result[item.name + rule] = vm.runInContext(`(${item.value})`)
              } catch (e:any) {
                result[item.name + rule] = item.value
              }
            } else {
              result[item.name + rule] = item.children.length ? [{}] : []
              item.children.forEach((child: any) => {
                parse(child, result[item.name + rule][0])
              })
            }
            break
          case 'Null':
            // tslint:disable-next-line: no-null-keyword
            result[item.name + rule] = null
            break
        }
      }
    }
    let result = {}
    tree.children.forEach((child: any) => {
      parse(child, result)
    })
    return result
  }

  public static TemplateToData(template: any) {
    // 数据模板 template 中可能含有攻击代码，例如死循环，所以在沙箱中生成最终数据
    // https://nodejs.org/dist/latest-v7.x/docs/api/vm.html

    const context = { mock: Mock.mock };
    vm.createContext(context);
    
    try {
      let data: any = vm.runInContext('mock(template)',template)
      let keys = Object.keys(data)
      if (keys.length === 1 && keys[0] === '__root__') data = data.__root__
      return data
    } catch (err) {
      console.error(err)
      return {}
    }
  }

  public static ArrayToTreeToSchema(list: Property[]) {
    let tree = Tree.ArrayToTree(list)
    return Tree.TreeToSchema(tree)
  }

  public static ArrayToTreeToTemplate(list: Property[]) {
    let tree = Tree.ArrayToTree(list)
    let template = Tree.TreeToTemplate(tree)
    return template
  }

  public static ArrayToTreeToTemplateToData(list: Property[], extra?: any) {
    let tree = Tree.ArrayToTree(list)
    let template: { [key: string]: any } = Tree.TreeToTemplate(tree)
    let data
    const propertyMap: { [key: string]: Property } = {}
    for (const p of list) {
      propertyMap[p.name] = p
    }
    if (extra) {
      // DONE 2.2 支持引用请求参数
      let keys = Object.keys(template).map(item => item.replace(RE_KEY, '$1'))
      let extraKeys = _.difference(Object.keys(extra), keys)
      let scopedData = Tree.TemplateToData(Object.assign({}, _.pick(extra, extraKeys), template))

      const recursivelyFillData = (node: any) => {
        for (const key in node) {
          if (!node.hasOwnProperty(key)) continue
          let data = node[key]
          if (_.isObject(data)) {
            recursivelyFillData(data)
            continue
          }
          for (const eKey in extra) {
            if (!extra.hasOwnProperty(eKey)) continue
            const pattern = new RegExp(`\\$${eKey}\\$`, 'g')
            if (data && pattern.test(data)) {
              let result = data.replace(pattern, extra[eKey])
              const p = propertyMap[key]
              if (p) {
                if (p.type === 'Number' || p.type === 'Long') {
                  result = +result || 1
                }
                if (p.type === 'Double') {
                  result = +result || 1.00
                } else if (p.type === 'Boolean') {
                  result = result === 'true' || !!+result
                }
                data = node[key] = result
              }
            }
          }
        }
      }
      recursivelyFillData(scopedData)
      data = _.pick(scopedData, keys)
    } else {
      data = Tree.TemplateToData(template)
    }

    return data
  }

  public static ArrayToTreeToTemplateToJSONSchema(list: Property[]) {
    let tree = Tree.ArrayToTree(list)
    let template = Tree.TreeToTemplate(tree)
    let schema = Mock.toJSONSchema(template)
    return schema
  }

  // TODO 2.2 执行 JSON.stringify() 序列化时会丢失正则和函数。需要转为字符串或者函数。
  // X Function.protytype.toJSON = Function.protytype.toString
  // X RegExp.protytype.toJSON = RegExp.protytype.toString
  public static stringifyWithFunctonAndRegExp(json: object) {
    return JSON.stringify(
      json,
      (k, v) => {
        k
        if (typeof v === 'function') return v.toString()
        if (v !== undefined && v !== null && v.exec) return v.toString()
        else return v
      },
      2,
    )
  }

  // 把用户的 mock json 转换成 json-schema 再转换成 properties
  public static jsonToArray(
    json: any,
    {
      userId,
      repositoryId,
      moduleId,
      interfaceId,
      scope,
    }: {
      userId: number
      repositoryId: number
      moduleId: number
      interfaceId: number
      scope: 'request' | 'response'
    },
  ) {
    const isIncreamentNumberSequence = (numbers: any) =>
      numbers.every(
        (num: any) =>
          typeof num === 'number' &&
          ((num: any, i: number) => i === 0 || num - numbers[i - 1] === 1),
      )
    function isPrimitiveType(type: string) {
      return ['number', 'null', 'undefined', 'boolean', 'string'].indexOf(type.toLowerCase()) > -1
    }
    function mixItemsProperties(items: any) {
      // 合并 item properties 的 key，返回的 item 拥有导入 json 的所有 key
      if (!items || !items.length) {
        return {
          properties: [],
        }
      } else if (items.length === 1) {
        if (!items[0].properties) {
          items[0].properties = []
        }
        return items[0]
      } else {
        const baseItem = items[0]
        if (!baseItem.properties) {
          baseItem.properties = []
        }
        const baseProperties = baseItem.properties
        for (let i = 1; i < items.length; ++i) {
          const item = items[i]
          if (item.properties && item.properties.length) {
            for (const p of item.properties) {
              if (!baseProperties.find((e: any) => e.name === p.name)) {
                baseProperties.push(p)
              }
            }
          }
        }
        return baseItem
      }
    }
    /** MockJS 的 toJSONSchema 的 bug 会导致有 length 属性的对象被识别成数组
     *  众所周知 MockJS 已经不维护了，所以只能自己想想办法
     *  先递归把 length 替换成其他的名称，生成 schema 后再换回来
     */
    const lengthAlias = '__mockjs_length_*#06#'

    const replaceLength = (obj: any) => {
      for (const k in obj) {
        if (obj[k] && typeof obj[k] === 'object') {
          replaceLength(obj[k])
        } else {
          // Do something with obj[k]
          if (k === 'length') {
            const v = obj[k]
            delete obj[k]
            obj[lengthAlias] = v
          }
        }
      }
    }
    function handleJSONSchema(
      schema: any,
      parent = { id: -1 },
      memoryProperties: any,
      siblings?: any,
    ) {
      if (!schema) {
        return
      }
      const hasSiblings = siblings instanceof Array && siblings.length > 0
      // DONE 2.1 需要与 Mock 的 rule.type 规则统一，首字符小写，好烦！应该忽略大小写！
      if (schema.name === lengthAlias) {
        schema.name = 'length'
      }
      let type = schema.type[0].toUpperCase() + schema.type.slice(1)
      let rule = ''
      if (type === 'Array' && schema.items && schema.items.length > 1) {
        rule = schema.items.length + ''
      }
      let value = /Array|Object/.test(type) ? '' : schema.template
      if (schema.items && schema.items.length) {
        const childType = schema.items[0].type
        if (isPrimitiveType(childType)) {
          value = JSON.stringify(schema.template)
          rule = ''
        }
      } else if (hasSiblings && isPrimitiveType(type)) {
        // 如果是简单数据可以在这里进行合并
        const valueArr = siblings.map((s: any) => s && s.template)
        if (_.uniq(valueArr).length > 1) {
          // 只有在数组里有不同元素时再合并
          if (isIncreamentNumberSequence(valueArr)) {
            // 如果是递增数字序列特殊处理
            value = valueArr[0]
            rule = '+1'
          } else {
            // 比如 [{a:1},{a:2}]
            // 我们可以用 type: Array rule: +1 value: [1,2] 进行还原
            value = JSON.stringify(valueArr)
            type = 'Array'
            rule = '+1'
          }
        }
      }

      type Property = {
        name: any
        type: any
        rule: string
        value: any
        descripton: string
        creator: any
        repositoryId: any
        moduleId: any
        interfaceId: any
        scope: any
        parentId: number
        memory: boolean
        id: any
      }
      const property: Property = Object.assign(
        {
          name: schema.name,
          type,
          rule,
          value,
          descripton: '',
        },
        {
          creator: userId,
          repositoryId: repositoryId,
          moduleId: moduleId,
          interfaceId,
          scope,
          parentId: parent.id,
        },
        {
          memory: true,
          id: _.uniqueId('memory-'),
        },
      )
      memoryProperties.push(property)
      if (schema.properties) {
        schema.properties.forEach((item: any) => {
          const childSiblings = hasSiblings
            ? siblings.map(
                (s: any) =>
                  (s && s.properties && s.properties.find((p: any) => p && p.name === item.name)) || null,
              )
            : undefined
          handleJSONSchema(item, property, memoryProperties, childSiblings)
        })
      }
      mixItemsProperties(schema.items).properties.forEach((item: any) => {
        const siblings = schema.items.map(
          (o: any) => o.properties.find((p: any) => p.name === item.name) || null,
        )
        handleJSONSchema(item, property, memoryProperties, siblings)
      })
    }

    if (JSON.stringify(json).indexOf('length') > -1) {
      // 递归查找替换 length 是一个重操作，先进行一次字符串查找，发现存在 length 字符再进行
      replaceLength(json)
    }

    if (json instanceof Array) {
      json = { _root_: json }
    }
    const schema = Mock.toJSONSchema(json)
    const memoryProperties: any = []
    if (schema.properties) {
      schema.properties.forEach((item: any) => handleJSONSchema(item, undefined, memoryProperties))
    }

    return memoryProperties
  }
}
