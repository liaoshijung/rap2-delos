import { Table, Column, Model, HasMany, AutoIncrement, PrimaryKey, AllowNull, DataType, Unique, BelongsToMany } from 'sequelize-typescript'
import { Organization, Repository, OrganizationsMembers, RepositoriesMembers, OrganizationsReaders } from '../'

@Table({ paranoid: true, freezeTableName: false, timestamps: true })
export default class User extends Model<User> {

  @AutoIncrement
  @PrimaryKey
  @Column
  id: number

  @AllowNull(false)
  @Column(DataType.STRING(32))
  fullname: string

  @Column(DataType.STRING(32))
  password: string

  @AllowNull(false)
  @Unique
  @Column(DataType.STRING(128))
  email: string

  @Column
  role: number

  @HasMany(() => Organization, 'ownerId')
  ownedOrganizations: Organization[]

  @BelongsToMany(() => Organization, () => OrganizationsMembers)
  joinedOrganizations: Organization[]

  @BelongsToMany(() => Organization, () => OrganizationsReaders)
  viewedOrganizations: Organization[]

  @HasMany(() => Repository, 'ownerId')
  ownedRepositories: Repository[]

  @BelongsToMany(() => Repository, () => RepositoriesMembers)
  joinedRepositories: Repository[]

}