// @ts-ignore
import config from '../config'
import { Client } from 'ldapts'
import {
  InvalidCredentialsError
} from 'ldapts/errors/resultCodeErrors'

console.log(config.ldapLogin.server)
const ldapClient = new Client({
  url: config.ldapLogin.server
})
const ldapQuery = async (user: { username: string | '', password: string | undefined }) => {
  const result = {
    success: true,
    errorMessage: '',
    name: '',
    mail: ''
  }
// ldapsearch -x -H ldap://ldap.forumsys.com:389 -D "cn=read-only-admin,dc=example,dc=com" -w password -b "dc=example,dc=com" "uid=einstein"
  try {
    console.log(user)
    await ldapClient.bind(user.username, user.password)

    const searchResult = await ldapClient.search('dc=foxhis,dc=local', {
      scope: 'sub',
      filter: '(userPrincipalName=' + user.username + ')',
    })
    result.name = searchResult.searchEntries[0].displayName.toString()
    result.mail = searchResult.searchEntries[0].mail.toString()
  } catch (ex) {
    console.log(ex)
    result.success = false
    if (ex instanceof InvalidCredentialsError) {
      result.errorMessage = '用户名或密码错误!'
      return result
    } else {
      result.errorMessage = '验证服务器连接异常，请联系系统管理员!'
      return result
    }
  } finally {
    await ldapClient.unbind()
  }
  return result
}
export default ldapQuery
