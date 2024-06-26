import MarkdownService from './markdown'
import pandoc from '../../helpers/pandoc'

const markdownToDocx = pandoc('markdown', 'docx', '--wrap', 'none')

export default class DocxService {
  public static async export(repositoryId: number, origin: string,moduleId?:string): Promise<Buffer> {
    const markdown = await MarkdownService.export(repositoryId, origin,moduleId)
    const docx = markdownToDocx(markdown)
    return docx
  }
}
