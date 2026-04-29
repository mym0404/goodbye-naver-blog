import type {
  ParserBlockContext,
  ParserBlockConvertContext,
  ParserBlockResult,
} from "./ParserNode.js"
import type { OutputOption } from "../../shared/Types.js"

export abstract class BaseBlock {
  readonly outputId?: string
  readonly outputOptions?: readonly OutputOption[]

  abstract match(context: ParserBlockContext): boolean

  abstract convert(context: ParserBlockConvertContext): ParserBlockResult
}

export abstract class ContainerBlock extends BaseBlock {}

export abstract class LeafBlock extends BaseBlock {}
