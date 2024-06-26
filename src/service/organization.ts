import seq from '../models/sequelize'
import Pagination from '../routes/utils/pagination'
import Utils from './utils'
import { Organization} from '../models'
export default class OrganizationService {
  public static canUserAccessOrganization(userId: number, organizationId: number): Promise<boolean> {
    const sql = `
      SELECT COUNT(id) AS num FROM (
        SELECT o.id
        FROM Organizations o
        WHERE ownerId = ${userId}
        UNION
        SELECT om.organizationId as id
        FROM organizations_members om
        WHERE om.userId = ${userId} 
      ) as result
      WHERE id = ${organizationId}
    `
    return new Promise(resolve => {
      seq.query(sql).spread((result: any) => {
        resolve(+result[0].num > 0)
      })
    })
  }

  public static canUserViewOrganization(userId: number, organizationId: number): Promise<boolean> {
    const sql = `
      SELECT COUNT(id) AS num FROM (
        SELECT o.id
        FROM Organizations o
        WHERE ownerId = ${userId}
        UNION
        SELECT om.organizationId as id
        FROM organizations_members om
        WHERE om.userId = ${userId} 
        UNION
        SELECT om.organizationId as id
        FROM organizations_readers om
        WHERE om.userId = ${userId} 
      ) as result
      WHERE id = ${organizationId}
    `
    return new Promise(resolve => {
      seq.query(sql).spread((result: any) => {
        resolve(+result[0].num > 0)
      })
    })
  }

  public static async canUserAccessOrganizationSet(userId: number, organizationId: number): Promise<boolean> {
    const org = await Organization.findByPk(organizationId)
    return org.ownerId === userId || org.creatorId === userId;
  }

  public static getAllOrganizationIdList(curUserId: number, pager: Pagination, query?: string): Promise<number[]> {
    if (query) {
      query = Utils.escapeSQL(query)
    }
    const sql = `
      SELECT id FROM (
        SELECT o.id, o.name
        FROM Organizations o
        WHERE visibility = ${1} OR ownerId = ${curUserId}
        UNION
        SELECT o.id, o.name
        FROM Organizations o
        JOIN organizations_members om ON o.id = om.organizationId
        WHERE om.userId = ${curUserId}
        UNION
        SELECT o.id, o.name
        FROM Organizations o
        JOIN organizations_readers om ON o.id = om.organizationId
        WHERE om.userId = ${curUserId}
      ) as result
      ${query ? `WHERE id = '${query}' OR name LIKE '%${query}%'` : ''}
      ORDER BY id desc
      LIMIT ${pager.start}, ${pager.limit}
    `
    return new Promise(resolve => {
      seq.query(sql).spread((result: { id: number }[]) => {
        resolve(result.map(item => item.id))
      })
    })
  }

  public static getAllOrganizationIdListNum(curUserId: number): Promise<number> {
    const sql = `
      SELECT count(*) AS num FROM (
        SELECT o.id, o.name
        FROM Organizations o
        WHERE visibility = ${1} OR ownerId = ${curUserId}
        UNION
        SELECT o.id, o.name
        FROM Organizations o
        JOIN organizations_members om ON o.id = om.organizationId
        WHERE om.userId = ${curUserId}
      ) as result
      ORDER BY id desc
    `
    return new Promise(resolve => {
      seq.query(sql).spread((result: { num: number }[]) => {
        resolve(result[0].num)
      })
    })
  }
}