import type {BlogEditorId} from "../BlogTypes.js";

export abstract class BaseBlog {
  protected constructor(readonly editorIds: BlogEditorId[]) {
  }
}
