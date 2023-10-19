import { Table, Column, Model, ForeignKey, PrimaryKey } from 'sequelize-typescript'
import { User,  Organization } from '..'

@Table({ freezeTableName: true, timestamps: true, tableName: 'organizations_readers' })
export default class OrganizationsReaders extends Model<OrganizationsReaders> {
    @ForeignKey(() => User)
    @PrimaryKey
    @Column
    userId: number

    @ForeignKey(() => Organization)
    @PrimaryKey
    @Column
    organizationId: number
}