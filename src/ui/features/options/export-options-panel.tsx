import type { ReactNode, SVGProps } from "react"

import type {
  ExportOptions,
  FrontmatterFieldMeta,
  FrontmatterFieldName,
  OptionDescriptionMap,
  ParserCapabilityId,
  PostSummary,
} from "../../../shared/types.js"
import {
  blockOutputCapabilityOverrideDefinitions,
  blockOutputFamilyDefinitions,
  getBlockOutputFamilyDefinition,
  resolveBlockOutputSelection,
} from "../../../shared/block-registry.js"
import { renderBlockOutputPreview } from "../../../shared/block-output-preview.js"
import { formatCategorySegment } from "../../../shared/path-format.js"
import { getDefaultSlugWhitespace } from "../../../shared/export-options.js"
import {
  applyPostTemplate,
  buildPostFolderName,
  buildPostTemplateValues,
  postTemplateKeys,
} from "../../../shared/post-path-template.js"

import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert.js"
import { Badge } from "../../components/ui/badge.js"
import { Button } from "../../components/ui/button.js"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card.js"
import {
  Collapsible,
  CollapsibleContent,
} from "../../components/ui/collapsible.js"
import { Checkbox } from "../../components/ui/checkbox.js"
import { Input } from "../../components/ui/input.js"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select.js"
import { cn } from "../../lib/cn.js"
import { exportOptionsStepMeta, type ExportOptionsStep } from "./export-options-steps.js"

type StructurePreviewTreeNode =
  | {
      kind: "file"
      name: string
    }
  | {
      kind: "folder"
      name: string
      items: StructurePreviewTreeNode[]
      defaultOpen?: boolean
    }

const structurePreviewSample = {
  posts: [
    {
      publishedAt: "2026-04-11T04:00:00.000Z",
      logNo: "223034929697",
      title: "첫 글",
      categoryPath: ["개발 메모", "React"],
    },
    {
      publishedAt: "2026-04-12T04:00:00.000Z",
      logNo: "223034929698",
      title: "둘째 글",
      categoryPath: ["개발 메모", "React"],
    },
    {
      publishedAt: "2026-04-14T04:00:00.000Z",
      logNo: "223034929755",
      title: "세 번째 정리",
      categoryPath: ["개발 메모", "TypeScript"],
    },
  ],
}

const buildStructurePreviewPostFolderName = ({
  post,
  options,
}: {
  post: (typeof structurePreviewSample.posts)[number]
  options: ExportOptions["structure"]
}) =>
  buildPostFolderName({
    post: {
      blogId: "mym0404",
      logNo: post.logNo,
      title: post.title,
      publishedAt: post.publishedAt,
      categoryName: post.categoryPath.at(-1),
    },
    options: {
      structure: options,
    },
  })

const findFolderNode = (nodes: StructurePreviewTreeNode[], name: string) =>
  nodes.find((node): node is Extract<StructurePreviewTreeNode, { kind: "folder" }> => node.kind === "folder" && node.name === name)

const appendStructurePreviewPost = ({
  items,
  post,
  options,
}: {
  items: StructurePreviewTreeNode[]
  post: (typeof structurePreviewSample.posts)[number]
  options: ExportOptions["structure"]
}) => {
  const postTree: StructurePreviewTreeNode = {
    kind: "folder",
    name: buildStructurePreviewPostFolderName({
      post,
      options,
    }),
    defaultOpen: true,
    items: [
      {
        kind: "file",
        name: "index.md",
      },
    ],
  }

  if (!options.groupByCategory) {
    items.push(postTree)
    return
  }

  let currentLevel = items

  for (const segment of post.categoryPath) {
    const folderName = formatCategorySegment({
      value: segment,
      slugStyle: options.slugStyle,
      slugWhitespace: options.slugWhitespace,
    })
    const existingFolder = findFolderNode(currentLevel, folderName)

    if (existingFolder) {
      currentLevel = existingFolder.items
      continue
    }

    const nextFolder: StructurePreviewTreeNode = {
      kind: "folder",
      name: folderName,
      defaultOpen: true,
      items: [],
    }

    currentLevel.push(nextFolder)
    currentLevel = nextFolder.items
  }

  currentLevel.push(postTree)
}

const buildStructurePreviewTree = ({
  outputDir,
  options,
}: {
  outputDir: string
  options: ExportOptions
}): StructurePreviewTreeNode => {
  const rootName = outputDir.trim() || "./output"
  const rootItems: StructurePreviewTreeNode[] = []

  structurePreviewSample.posts.forEach((post) => {
    appendStructurePreviewPost({
      items: rootItems,
      post,
      options: options.structure,
    })
  })

  if (options.assets.imageHandlingMode !== "remote" && (options.assets.downloadImages || options.assets.downloadThumbnails)) {
    const publicItems: StructurePreviewTreeNode[] = []

    if (options.assets.downloadImages) {
      publicItems.push({
        kind: "file",
        name: "b7d3f1-cover.jpg",
      })
    }

    if (options.assets.downloadThumbnails && options.assets.thumbnailSource !== "none") {
      publicItems.push({
        kind: "file",
        name: "18ce42-thumb.jpg",
      })
    }

    if (publicItems.length > 0) {
      rootItems.push({
        kind: "folder",
        name: "public",
        items: publicItems,
      })
    }
  }

  rootItems.push({
    kind: "file",
    name: "manifest.json",
  })

  return {
    kind: "folder",
    name: rootName,
    defaultOpen: true,
    items: rootItems,
  }
}

const TreeChevronIcon = ({ className, ...props }: SVGProps<SVGSVGElement>) => (
  <svg
    aria-hidden="true"
    className={className}
    fill="none"
    viewBox="0 0 16 16"
    {...props}
  >
    <path
      d="m6 3 5 5-5 5"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
    />
  </svg>
)

const TreeFolderIcon = ({ className, ...props }: SVGProps<SVGSVGElement>) => (
  <svg
    aria-hidden="true"
    className={className}
    fill="none"
    viewBox="0 0 16 16"
    {...props}
  >
    <path
      d="M2 4.75c0-.97.78-1.75 1.75-1.75h2.12c.46 0 .89.18 1.22.51l.52.52c.19.19.44.29.7.29h3.94c.97 0 1.75.78 1.75 1.75v5.18c0 .97-.78 1.75-1.75 1.75H3.75A1.75 1.75 0 0 1 2 11.25z"
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth="1.2"
    />
  </svg>
)

const TreeFileIcon = ({ className, ...props }: SVGProps<SVGSVGElement>) => (
  <svg
    aria-hidden="true"
    className={className}
    fill="none"
    viewBox="0 0 16 16"
    {...props}
  >
    <path
      d="M4 2.75C4 2.34 4.34 2 4.75 2h4.94c.2 0 .39.08.53.22l1.56 1.56c.14.14.22.33.22.53v8.94c0 .41-.34.75-.75.75h-6.5A.75.75 0 0 1 4 13.25z"
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth="1.2"
    />
    <path d="M9.5 2.25v2.5h2.5" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.2" />
  </svg>
)

const StructurePreviewTree = ({
  node,
  depth = 0,
}: {
  node: StructurePreviewTreeNode
  depth?: number
}) => {
  if (node.kind === "file") {
    return (
      <div
        className={cn("flex min-h-7 items-center gap-1.5 rounded-md px-1.5 py-1 text-muted-foreground", depth > 0 && "ml-2")}
        data-tree-kind="file"
      >
        <TreeFileIcon className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 truncate font-mono text-[0.75rem] leading-5">{node.name}</span>
      </div>
    )
  }

  return (
    <Collapsible className="grid gap-0.5" open>
      <div
        className={cn(
          "flex min-h-7 items-center gap-1.5 rounded-md px-1.5 py-1",
          depth > 0 && "ml-2",
        )}
      >
        <TreeChevronIcon className="size-3.5 shrink-0 rotate-90 text-muted-foreground" />
        <TreeFolderIcon className="size-3.5 shrink-0 text-[var(--status-running-fg)]" />
        <span className="min-w-0 truncate font-mono text-[0.75rem] leading-5 text-foreground">{node.name}</span>
      </div>
      <CollapsibleContent className="grid gap-0.5 border-l border-border pl-2.5">
        {node.items.map((child) => (
          <StructurePreviewTree key={`${node.name}:${child.name}`} node={child} depth={depth + 1} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  )
}

const optionFieldClass = "field-card grid min-h-[6.25rem] content-start gap-1.5 self-start rounded-2xl px-3 py-3"
const checkFieldClass = "field-card flex flex-col rounded-2xl px-3 py-3"
const optionSectionClass = "option-section subtle-panel grid gap-3 rounded-[1.35rem] p-3.5"
type SelectOption = {
  value: string
  label: string
}

const OptionField = ({
  optionKey,
  labelFor,
  label,
  description,
  children,
  disabled = false,
}: {
  optionKey: string
  labelFor?: string
  label: string
  description?: string
  children: ReactNode
  disabled?: boolean
}) => (
  <div className={cn(optionFieldClass, disabled && "opacity-60")} data-option-key={optionKey} aria-disabled={disabled}>
    <label htmlFor={labelFor} className="text-sm font-semibold text-foreground">
      {label}
    </label>
    {children}
    {description ? <small className="field-help text-[13px] leading-5">{description}</small> : null}
  </div>
)

const OptionSelectField = <T extends string,>({
  inputId,
  value,
  options,
  disabled = false,
  placeholder,
  describedBy,
  ariaInvalid = false,
  onValueChange,
}: {
  inputId: string
  value: T
  options: SelectOption[]
  disabled?: boolean
  placeholder?: string
  describedBy?: string
  ariaInvalid?: boolean
  onValueChange: (value: T) => void
}) => (
  <Select value={value} disabled={disabled} onValueChange={(nextValue) => onValueChange(nextValue as T)}>
    <SelectTrigger id={inputId} data-value={value} aria-describedby={describedBy} aria-invalid={ariaInvalid || undefined}>
      <SelectValue placeholder={placeholder} />
    </SelectTrigger>
    <SelectContent>
      <SelectGroup>
        {options.map((option) => (
          <SelectItem key={`${inputId}:${option.value}`} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectGroup>
    </SelectContent>
  </Select>
)

const CheckField = ({
  inputId,
  optionKey,
  label,
  description,
  checked,
  onChange,
  compact = false,
  disabled = false,
}: {
  inputId: string
  optionKey: string
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
  compact?: boolean
  disabled?: boolean
}) => (
  <label
    className={cn(checkFieldClass, compact ? "min-h-0 gap-2" : "min-h-[7.75rem] gap-3", disabled && "opacity-60")}
    data-option-key={optionKey}
    aria-disabled={disabled}
  >
    <span className={`check-head flex gap-3 ${compact ? "items-center" : "items-start"}`}>
      <Checkbox
        id={inputId}
        checked={checked}
        disabled={disabled}
        className="mt-0.5"
        onCheckedChange={(next) => onChange(next === true)}
      />
      <span className="check-copy grid min-w-0 gap-1">
        <span className="check-title text-sm font-semibold text-foreground">{label}</span>
      </span>
    </span>
    {description ? <small className="field-help text-[13px] leading-5">{description}</small> : null}
  </label>
)

const RadioField = ({
  inputId,
  name,
  optionKey,
  label,
  description,
  checked,
  onChange,
  children,
}: {
  inputId: string
  name: string
  optionKey: string
  label: string
  description?: string
  checked: boolean
  onChange: () => void
  children?: ReactNode
}) => (
  <label className={cn(checkFieldClass, checked && "shadow-[var(--focus-ring)]")} data-option-key={optionKey}>
    <span className="check-head flex items-start gap-3">
      <input
        id={inputId}
        name={name}
        className="mt-0.5 size-[1.1rem] shrink-0 accent-primary"
        type="radio"
        checked={checked}
        onChange={onChange}
      />
      <span className="check-copy grid min-w-0 gap-1">
        <span className="check-title text-sm font-semibold text-foreground">{label}</span>
        {description ? <small className="field-help text-[13px] leading-5">{description}</small> : null}
      </span>
    </span>
    {children ? <div className="pt-3">{children}</div> : null}
  </label>
)

const OptionSection = ({
  title,
  note,
  children,
}: {
  title: string
  note: string
  children: ReactNode
}) => (
  <section className={optionSectionClass}>
    <div className="option-section-header flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h3 className="text-lg font-semibold tracking-[-0.03em] text-foreground">{title}</h3>
        <p className="mt-0.5 text-[13px] leading-5 text-muted-foreground">{note}</p>
      </div>
    </div>
    <div className="option-grid grid items-start gap-3 xl:grid-cols-2">{children}</div>
  </section>
)

const blockOutputCardClass = "field-card grid gap-4 rounded-[1.5rem] px-4 py-4 xl:col-span-2"

const isBlockOutputParamVisible = ({
  variant,
  variants,
}: {
  variant: string
  variants?: string[]
}) => !variants || variants.includes(variant)

const BlockOutputPreview = ({
  snippet,
}: {
  snippet: string
}) => (
  <div className="grid content-start gap-2 self-start">
    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Preview</span>
    <pre className="code-surface overflow-x-auto whitespace-pre-wrap rounded-2xl px-3 py-3 font-mono text-[0.8125rem] leading-6 text-foreground">
      {snippet}
    </pre>
  </div>
)

const BlockOutputCard = ({
  options,
  family,
  overrideCapabilityId,
  onOptionsChange,
}: {
  options: ExportOptions
  family: (typeof blockOutputFamilyDefinitions)[number]
  overrideCapabilityId?: ParserCapabilityId
  onOptionsChange: (updater: (current: ExportOptions) => ExportOptions) => void
}) => {
  const selection = resolveBlockOutputSelection({
    blockType: family.blockType,
    capabilityId: overrideCapabilityId,
    blockOutputs: options.blockOutputs,
  })
  const overrideDefinition = overrideCapabilityId
    ? blockOutputCapabilityOverrideDefinitions.find((item) => item.capabilityId === overrideCapabilityId)
    : null
  const previewSnippet = renderBlockOutputPreview({
    block: overrideCapabilityId
      ? (overrideDefinition?.previewBlock ?? family.previewBlock)
      : family.previewBlock,
    selection,
    linkStyle: options.markdown.linkStyle,
    includeImageCaptions: options.assets.includeImageCaptions,
    imageHandlingMode: options.assets.imageHandlingMode,
  })
  const optionKeyPrefix = overrideCapabilityId ? `blockOutputs-overrides-${overrideCapabilityId}` : `blockOutputs-defaults-${family.blockType}`
  const updateSelection = (updater: (current: NonNullable<typeof selection>) => NonNullable<typeof selection>) => {
    onOptionsChange((current) => {
      const currentSelection = resolveBlockOutputSelection({
        blockType: family.blockType,
        capabilityId: overrideCapabilityId,
        blockOutputs: current.blockOutputs,
      })
      const nextSelection = updater(currentSelection)

      if (overrideCapabilityId) {
        return {
          ...current,
          blockOutputs: {
            ...current.blockOutputs,
            overrides: {
              ...current.blockOutputs.overrides,
              [overrideCapabilityId]: nextSelection,
            },
          },
        }
      }

      return {
        ...current,
        blockOutputs: {
          ...current.blockOutputs,
          defaults: {
            ...current.blockOutputs.defaults,
            [family.blockType]: nextSelection,
          },
        },
      }
    })
  }

  return (
    <Card className={blockOutputCardClass} data-block-output-card={overrideCapabilityId ?? family.blockType}>
      <CardHeader className="gap-2 px-0 pb-0">
        <div className="flex items-start justify-between gap-3">
          <div className="grid gap-1">
            <CardTitle className="text-base tracking-[-0.03em]">
              {overrideCapabilityId
                ? overrideDefinition?.label ?? family.label
                : family.label}
            </CardTitle>
            <CardDescription className="text-sm leading-6">
              {overrideCapabilityId
                ? overrideDefinition?.description ?? family.description
                : family.description}
            </CardDescription>
          </div>
          {overrideCapabilityId ? <Badge variant="secondary">{overrideCapabilityId}</Badge> : <Badge variant="outline">{family.blockType}</Badge>}
        </div>
      </CardHeader>
      <CardContent className="grid content-start gap-4 px-0 pb-0">
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)]">
          <div className="grid content-start gap-4 self-start">
            {family.variants.length > 1 ? (
              <OptionField
                optionKey={`${optionKeyPrefix}-variant`}
                labelFor={`${optionKeyPrefix}-variant`}
                label="출력 방식"
              >
                <OptionSelectField
                  inputId={`${optionKeyPrefix}-variant`}
                  value={selection.variant}
                  options={family.variants.map((variant) => ({
                    value: variant.id,
                    label: variant.label,
                  }))}
                  onValueChange={(variant) =>
                    updateSelection((current) => ({
                      ...current,
                      variant,
                    }))
                  }
                />
              </OptionField>
            ) : null}

            {family.params
              ?.filter((param) =>
                isBlockOutputParamVisible({
                  variant: selection.variant,
                  variants: param.whenVariants,
                }),
              )
              .map((param) => (
                <OptionField
                  key={`${optionKeyPrefix}-${param.key}`}
                  optionKey={`${optionKeyPrefix}-${param.key}`}
                  label={param.label}
                  description={param.description}
                >
                  <Input
                    id={`${optionKeyPrefix}-${param.key}`}
                    type={param.input === "number" ? "number" : "text"}
                    value={String(selection.params?.[param.key] ?? "")}
                    onChange={(event) =>
                      updateSelection((current) => ({
                        ...current,
                        params: {
                          ...(current.params ?? {}),
                          [param.key]:
                            param.input === "number"
                              ? Number(event.target.value || "0")
                              : event.target.value,
                        },
                      }))
                    }
                  />
                </OptionField>
              ))}
          </div>

          <BlockOutputPreview snippet={previewSnippet} />
        </div>
      </CardContent>
    </Card>
  )
}

const linkTemplateVariableMeta: Record<
  (typeof postTemplateKeys)[number],
  {
    label: string
    description: string
  }
> = {
  slug: {
    label: "{slug}",
    description: "제목을 현재 slug 규칙에 맞춰 바꾼 값입니다.",
  },
  category: {
    label: "{category}",
    description: "카테고리 이름을 현재 slug 규칙에 맞춰 바꾼 값입니다.",
  },
  title: {
    label: "{title}",
    description: "제목만 path-safe 값으로 넣습니다.",
  },
  logNo: {
    label: "{logNo}",
    description: "네이버 글 번호를 그대로 넣습니다.",
  },
  blogId: {
    label: "{blogId}",
    description: "현재 export 중인 블로그 ID를 넣습니다.",
  },
  date: {
    label: "{date}",
    description: "발행일을 YYYY-MM-DD 형식으로 넣습니다.",
  },
  year: {
    label: "{year}",
    description: "발행 연도를 4자리로 넣습니다.",
  },
  YYYY: {
    label: "{YYYY}",
    description: "발행 연도를 4자리로 넣습니다.",
  },
  YY: {
    label: "{YY}",
    description: "발행 연도 뒤 2자리만 넣습니다.",
  },
  month: {
    label: "{month}",
    description: "발행 월을 2자리로 넣습니다.",
  },
  MM: {
    label: "{MM}",
    description: "발행 월을 2자리로 넣습니다.",
  },
  M: {
    label: "{M}",
    description: "발행 월을 1~12 숫자로 넣습니다.",
  },
  day: {
    label: "{day}",
    description: "발행 일을 2자리로 넣습니다.",
  },
  DD: {
    label: "{DD}",
    description: "발행 일을 2자리로 넣습니다.",
  },
  D: {
    label: "{D}",
    description: "발행 일을 1~31 숫자로 넣습니다.",
  },
}

export const ExportOptionsPanel = ({
  step,
  outputDir,
  options,
  optionDescriptions,
  frontmatterFieldOrder,
  frontmatterFieldMeta,
  frontmatterValidationErrors,
  linkTemplatePreviewPost,
  onOutputDirChange,
  onOptionsChange,
}: {
  step: ExportOptionsStep
  outputDir: string
  options: ExportOptions
  optionDescriptions: OptionDescriptionMap
  frontmatterFieldOrder: FrontmatterFieldName[]
  frontmatterFieldMeta: Record<FrontmatterFieldName, FrontmatterFieldMeta>
  frontmatterValidationErrors: string[]
  linkTemplatePreviewPost?: Pick<PostSummary, "blogId" | "logNo" | "title" | "publishedAt" | "categoryName"> | null
  onOutputDirChange: (value: string) => void
  onOptionsChange: (updater: (current: ExportOptions) => ExportOptions) => void
}) => {
  const description = (key: string) => optionDescriptions[key]
  const structureTemplatePreviewPost = {
    blogId: "mym0404",
    logNo: structurePreviewSample.posts[0]?.logNo ?? "223034929697",
    title: structurePreviewSample.posts[0]?.title ?? "첫 글",
    publishedAt: structurePreviewSample.posts[0]?.publishedAt ?? "2026-04-11T04:00:00.000Z",
    categoryName: structurePreviewSample.posts[0]?.categoryPath.at(-1) ?? "React",
  }
  const linkTemplatePreviewValues = linkTemplatePreviewPost
    ? buildPostTemplateValues({
        post: linkTemplatePreviewPost,
        options,
      })
    : null
  const structureTemplatePreviewValues = buildPostTemplateValues({
    post: structureTemplatePreviewPost,
    options,
  })
  const customUrlTemplate = options.links.sameBlogPostCustomUrlTemplate.trim()
  const customUrlPreview =
    linkTemplatePreviewValues && customUrlTemplate
      ? applyPostTemplate({
          template: customUrlTemplate,
          values: linkTemplatePreviewValues,
        })
      : null
  const postFolderNameTemplate = options.structure.postFolderNameCustomTemplate.trim()
  const postFolderNamePreview =
    postFolderNameTemplate &&
    buildPostFolderName({
      post: structureTemplatePreviewPost,
      options: {
        structure: options.structure,
      },
    })
  const structurePreviewTree = buildStructurePreviewTree({
    outputDir,
    options,
  })

  const structureSection = (
    <>
      <OptionSection title="구조" note="출력 폴더와 파일 이름 규칙">
        <CheckField
          inputId="structure-groupByCategory"
          optionKey="structure-groupByCategory"
          label="카테고리 폴더 유지"
          description={description("structure-groupByCategory")}
          checked={options.structure.groupByCategory}
          onChange={(checked) =>
            onOptionsChange((current) => ({
              ...current,
              structure: {
                ...current.structure,
                groupByCategory: checked,
              },
            }))
          }
        />

        <CheckField
          inputId="structure-includeDateInPostFolderName"
          optionKey="structure-includeDateInPostFolderName"
          label="글 폴더 이름에 날짜 포함"
          description={description("structure-includeDateInPostFolderName")}
          checked={options.structure.includeDateInPostFolderName}
          disabled={options.structure.postFolderNameMode === "custom-template"}
          onChange={(checked) =>
            onOptionsChange((current) => ({
              ...current,
              structure: {
                ...current.structure,
                includeDateInPostFolderName: checked,
              },
            }))
          }
        />

        <CheckField
          inputId="structure-includeLogNoInPostFolderName"
          optionKey="structure-includeLogNoInPostFolderName"
          label="글 폴더 이름에 logNo 포함"
          description={description("structure-includeLogNoInPostFolderName")}
          checked={options.structure.includeLogNoInPostFolderName}
          disabled={options.structure.postFolderNameMode === "custom-template"}
          onChange={(checked) =>
            onOptionsChange((current) => ({
              ...current,
              structure: {
                ...current.structure,
                includeLogNoInPostFolderName: checked,
              },
            }))
          }
        />

        <OptionField
          optionKey="structure-slugStyle"
          labelFor="structure-slugStyle"
          label="slug/카테고리 표기 방식"
          description={description("structure-slugStyle")}
        >
          <OptionSelectField
            inputId="structure-slugStyle"
            value={options.structure.slugStyle}
            options={[
              { value: "kebab", label: "kebab-case" },
              { value: "snake", label: "snake_case" },
              { value: "keep-title", label: "원본 제목 유지" },
            ]}
            onValueChange={(slugStyle) =>
              onOptionsChange((current) => ({
                ...current,
                structure: {
                  ...current.structure,
                  slugStyle,
                  slugWhitespace: getDefaultSlugWhitespace(slugStyle),
                },
              }))
            }
          />
        </OptionField>

        <OptionField
          optionKey="structure-slugWhitespace"
          labelFor="structure-slugWhitespace"
          label="slug/카테고리 공백 처리"
          description={description("structure-slugWhitespace")}
        >
          <OptionSelectField
            inputId="structure-slugWhitespace"
            value={options.structure.slugWhitespace}
            options={[
              { value: "dash", label: "-로 바꾸기" },
              { value: "underscore", label: "_로 바꾸기" },
              { value: "keep-space", label: "공백 유지" },
            ]}
            onValueChange={(slugWhitespace) =>
              onOptionsChange((current) => ({
                ...current,
                structure: {
                  ...current.structure,
                  slugWhitespace,
                },
              }))
            }
          />
        </OptionField>

        <div className="grid gap-4 xl:col-span-2">
          <RadioField
            inputId="structure-postFolderNameMode-preset"
            name="structure-postFolderNameMode"
            optionKey="structure-postFolderNameMode"
            label="기본 규칙으로 글 폴더 이름 만들기"
            description="날짜 포함, logNo 포함, slug 규칙을 조합해서 만듭니다."
            checked={options.structure.postFolderNameMode === "preset"}
            onChange={() =>
              onOptionsChange((current) => ({
                ...current,
                structure: {
                  ...current.structure,
                  postFolderNameMode: "preset",
                },
              }))
            }
          />

          <RadioField
            inputId="structure-postFolderNameMode-custom-template"
            name="structure-postFolderNameMode"
            optionKey="structure-postFolderNameMode"
            label="템플릿으로 글 폴더 이름 직접 구성"
            description={description("structure-postFolderNameMode")}
            checked={options.structure.postFolderNameMode === "custom-template"}
            onChange={() =>
              onOptionsChange((current) => ({
                ...current,
                structure: {
                  ...current.structure,
                  postFolderNameMode: "custom-template",
                },
              }))
            }
          >
            {options.structure.postFolderNameMode === "custom-template" ? (
              <div className="grid gap-3 pl-7">
                <label className="subtle-panel field grid min-h-0 gap-2 rounded-2xl px-4 py-4">
                  <span className="text-sm font-semibold text-foreground">폴더명 템플릿</span>
                  <Input
                    id="structure-postFolderNameCustomTemplate"
                    value={options.structure.postFolderNameCustomTemplate}
                    placeholder="{date}-{slug}"
                    onChange={(event) =>
                      onOptionsChange((current) => ({
                        ...current,
                        structure: {
                          ...current.structure,
                          postFolderNameCustomTemplate: event.target.value,
                        },
                      }))
                    }
                  />
                  <small className="field-help text-sm leading-6">
                    결과는 한 폴더 이름으로 정리됩니다. 예: <span className="font-mono text-foreground">{"{date}"}-{"{category}"}-{"{slug}"}</span>
                  </small>
                </label>

                <div className="field-card grid gap-3 rounded-2xl px-4 py-4">
                  <div className="grid gap-1">
                    <span className="text-sm font-semibold text-foreground">실시간 폴더명 예시</span>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {structureTemplatePreviewPost.title} 글을 기준으로 바로 보여줍니다.
                    </p>
                  </div>

                  <div className="grid gap-2 text-sm leading-6 text-muted-foreground">
                    <span>현재 템플릿</span>
                    <code className="code-surface break-all px-3 py-2 font-mono text-[0.8125rem] text-foreground">
                      {postFolderNameTemplate || "(비어 있음)"}
                    </code>
                  </div>

                  <div className="grid gap-2 text-sm leading-6 text-muted-foreground">
                    <span>폴더 이름 결과</span>
                    <code
                      id="structure-postFolderNameCustomTemplatePreview"
                      className="code-surface-inverse break-all px-3 py-2 font-mono text-[0.8125rem]"
                    >
                      {postFolderNamePreview ?? "템플릿을 입력하면 결과가 여기에서 바로 바뀝니다."}
                    </code>
                  </div>
                </div>

                <div className="field-card grid gap-3 rounded-2xl px-4 py-4">
                  <div className="grid gap-1">
                    <span className="text-sm font-semibold text-foreground">사용 가능한 변수</span>
                    <p className="text-sm leading-6 text-muted-foreground">
                      아래 값은 구조 예시 글 하나를 기준으로 바로 계산합니다.
                    </p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    {postTemplateKeys.map((key) => {
                      const meta = linkTemplateVariableMeta[key]
                      const exampleValue = structureTemplatePreviewValues[key]

                      return (
                        <div
                          key={`structure-${key}`}
                          className="subtle-panel grid gap-2 rounded-2xl px-3 py-3"
                        >
                          <div className="flex items-center gap-2">
                            <span className="rounded-md bg-[var(--status-running-bg)] px-1.5 py-0.5 font-mono text-sm text-[var(--status-running-fg)]">
                              {meta.label}
                            </span>
                            <span className="text-sm font-medium text-foreground">{meta.description}</span>
                          </div>
                          <div className="grid gap-1 text-sm leading-6 text-muted-foreground">
                            <span>예시 값</span>
                            <code className="code-surface break-all px-2 py-1 font-mono text-[0.8125rem] text-foreground">
                              {exampleValue}
                            </code>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            ) : null}
          </RadioField>
        </div>

        <div
          id="structure-file-tree-preview"
          className="field-card grid gap-3 rounded-2xl px-4 py-4 xl:col-span-2"
        >
          <div className="grid gap-1">
            <span className="text-sm font-semibold text-foreground">예시 파일 트리</span>
            <p className="text-sm leading-6 text-muted-foreground">
              현재 옵션 기준으로 여러 글이 저장되는 예시입니다.
            </p>
          </div>
          <div className="subtle-panel rounded-xl p-2">
            <StructurePreviewTree node={structurePreviewTree} />
          </div>
        </div>
      </OptionSection>
    </>
  )

  const frontmatterSection = (
    <OptionSection title="Frontmatter" note="메타데이터 블록">
        <div className="frontmatter-toolbar grid gap-3 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <CheckField
          inputId="frontmatter-enabled"
          optionKey="frontmatter-enabled"
          label="Frontmatter 사용"
          description={description("frontmatter-enabled")}
          checked={options.frontmatter.enabled}
          compact
          onChange={(checked) =>
            onOptionsChange((current) => ({
              ...current,
              frontmatter: {
                ...current.frontmatter,
                enabled: checked,
              },
            }))
          }
        />
        <div
          className={cn(
            "frontmatter-state-card field-card flex min-h-0 flex-col justify-between gap-3 rounded-2xl px-4 py-4 sm:flex-row sm:items-start",
            frontmatterValidationErrors.length > 0 &&
              "border-[color-mix(in_srgb,var(--status-error-fg)_26%,transparent)] shadow-[var(--panel-shadow-border),0_0_0_1px_color-mix(in_srgb,var(--status-error-fg)_12%,transparent)]",
          )}
          data-state={frontmatterValidationErrors.length > 0 ? "error" : "default"}
        >
          <div className="frontmatter-state-copy grid min-w-0 gap-2">
            <span className="frontmatter-state-label text-sm font-semibold text-foreground">Alias 상태</span>
            <p className="frontmatter-description text-sm leading-6">
              {frontmatterValidationErrors.length > 0
                ? "중복되거나 비어 있는 alias를 먼저 정리해야 내보내기를 진행할 수 있습니다."
                : "현재 frontmatter alias 구성이 유효합니다."}
            </p>
          </div>
          <Badge
            className="frontmatter-state-badge flex min-w-[4.5rem] justify-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]"
            variant={frontmatterValidationErrors.length > 0 ? "destructive" : "secondary"}
          >
            {frontmatterValidationErrors.length > 0 ? "alias 오류" : "정상"}
          </Badge>
        </div>
      </div>

      {frontmatterValidationErrors.length > 0 ? (
        <Alert
          id="frontmatter-status"
          className="frontmatter-alert rounded-2xl px-4 py-4"
          data-state="error"
          variant="destructive"
        >
          <AlertTitle>Frontmatter alias</AlertTitle>
          <AlertDescription>{frontmatterValidationErrors.join(" ")}</AlertDescription>
        </Alert>
      ) : null}

      <div
        id="frontmatter-fields"
        className="frontmatter-grid grid gap-3 md:grid-cols-2 xl:col-span-2 2xl:grid-cols-3"
      >
        {frontmatterFieldOrder.map((fieldName) => {
          const fieldMeta = frontmatterFieldMeta[fieldName]
          const fieldEnabled = options.frontmatter.fields[fieldName]
          const hasError = frontmatterValidationErrors.some((error) => error.includes(fieldName))

          return (
            <div
              key={fieldName}
              className={cn(
                "frontmatter-row field-card grid content-start gap-3 rounded-2xl px-3 py-3",
                hasError &&
                  "border-[color-mix(in_srgb,var(--status-error-fg)_26%,transparent)] shadow-[var(--panel-shadow-border),0_0_0_1px_color-mix(in_srgb,var(--status-error-fg)_12%,transparent)]",
              )}
              data-frontmatter-field={fieldName}
              data-state={hasError ? "error" : "default"}
            >
              <div className="frontmatter-main grid gap-3">
                <label className="frontmatter-toggle inline-flex items-start gap-3" htmlFor={`frontmatter-field-${fieldName}`}>
                  <Checkbox
                    id={`frontmatter-field-${fieldName}`}
                    checked={fieldEnabled}
                    className="mt-0.5"
                    onCheckedChange={(next) =>
                      onOptionsChange((current) => ({
                        ...current,
                        frontmatter: {
                          ...current.frontmatter,
                          fields: {
                            ...current.frontmatter.fields,
                            [fieldName]: next === true,
                          },
                        },
                      }))
                    }
                  />
                  <span className="frontmatter-toggle-copy grid gap-0.5">
                    <span className="text-sm font-semibold text-foreground">{fieldMeta.label}</span>
                  </span>
                </label>
                <p className="frontmatter-description text-[13px] leading-5">{fieldMeta.description}</p>
              </div>
              <label className="field frontmatter-alias-field grid min-h-0 gap-1.5">
                <span className="text-sm font-semibold text-foreground">내보낼 key alias</span>
                <Input
                  data-alias-input="true"
                  data-field-name={fieldName}
                  value={options.frontmatter.aliases[fieldName] ?? ""}
                  placeholder={fieldMeta.defaultAlias}
                  aria-invalid={hasError || undefined}
                  className={
                    hasError
                      ? "border-[var(--destructive)] shadow-[var(--panel-shadow-border),0_0_0_1px_color-mix(in_srgb,var(--destructive)_18%,transparent)]"
                      : undefined
                  }
                  disabled={!options.frontmatter.enabled || !fieldEnabled}
                  onChange={(event) =>
                    onOptionsChange((current) => ({
                      ...current,
                      frontmatter: {
                        ...current.frontmatter,
                        aliases: {
                          ...current.frontmatter.aliases,
                          [fieldName]: event.target.value,
                        },
                      },
                    }))
                  }
                />
              </label>
            </div>
          )
        })}
      </div>
    </OptionSection>
  )

  const markdownSection = (
    <OptionSection title="Markdown 규칙" note="링크 방식과 블록별 출력 결과를 정합니다. 아래 preview는 실제 export될 Markdown snippet 기준입니다.">
      <OptionField
        optionKey="markdown-linkStyle"
        labelFor="markdown-linkStyle"
        label="링크 형식"
        description={description("markdown-linkStyle")}
      >
        <OptionSelectField
          inputId="markdown-linkStyle"
          value={options.markdown.linkStyle}
          options={[
            { value: "inlined", label: "inline links" },
            { value: "referenced", label: "reference links" },
          ]}
          onValueChange={(linkStyle) =>
            onOptionsChange((current) => ({
              ...current,
              markdown: {
                ...current.markdown,
                linkStyle,
              },
            }))
          }
        />
      </OptionField>
      {blockOutputFamilyDefinitions.map((family) => (
        <BlockOutputCard
          key={family.blockType}
          options={options}
          family={family}
          onOptionsChange={onOptionsChange}
        />
      ))}
      <div className="field-card grid gap-3 rounded-[1.5rem] px-4 py-4 xl:col-span-2">
        <div className="grid gap-1">
          <p className="text-sm font-semibold text-foreground">Capability override</p>
          <p className="field-help text-sm leading-6">
            기본 블록 출력과 다르게 처리할 capability만 별도로 덮어씁니다.
          </p>
        </div>
        <div className="grid gap-4">
          {blockOutputCapabilityOverrideDefinitions.map((overrideDefinition) => {
            const family = getBlockOutputFamilyDefinition(overrideDefinition.blockType)

            if (!family) {
              return null
            }

            return (
              <BlockOutputCard
                key={overrideDefinition.capabilityId}
                options={options}
                family={family}
                overrideCapabilityId={overrideDefinition.capabilityId}
                onOptionsChange={onOptionsChange}
              />
            )
          })}
        </div>
      </div>
    </OptionSection>
  )

  const assetsSection = (
    <OptionSection title="Assets" note="다운로드와 참조 방식">
      <OptionField
        optionKey="assets-imageHandlingMode"
        labelFor="assets-imageHandlingMode"
        label="이미지 처리 방식"
        description={description("assets-imageHandlingMode")}
      >
        <OptionSelectField
          inputId="assets-imageHandlingMode"
          value={options.assets.imageHandlingMode}
          options={[
            { value: "download", label: "다운로드 유지" },
            { value: "remote", label: "네이버 원본 URL 유지" },
            { value: "download-and-upload", label: "다운로드 후 Image Upload" },
          ]}
          onValueChange={(imageHandlingMode) =>
            onOptionsChange((current) => ({
              ...current,
              assets: {
                ...current.assets,
                imageHandlingMode,
                compressionEnabled:
                  imageHandlingMode === "remote" ? false : current.assets.compressionEnabled,
                downloadImages:
                  imageHandlingMode === "remote"
                    ? false
                    : imageHandlingMode === "download-and-upload"
                      ? true
                      : current.assets.downloadImages,
                downloadThumbnails:
                  imageHandlingMode === "remote"
                    ? false
                    : imageHandlingMode === "download-and-upload"
                      ? true
                      : current.assets.downloadThumbnails,
              },
            }))
          }
        />
      </OptionField>

      <CheckField
        inputId="assets-compressionEnabled"
        optionKey="assets-compressionEnabled"
        label="로컬 이미지 압축"
        description={description("assets-compressionEnabled")}
        checked={options.assets.compressionEnabled}
        disabled={options.assets.imageHandlingMode === "remote"}
        onChange={(checked) =>
          onOptionsChange((current) => ({
            ...current,
            assets: {
              ...current.assets,
              compressionEnabled: checked,
            },
          }))
        }
      />

      <OptionField
        optionKey="assets-stickerAssetMode"
        labelFor="assets-stickerAssetMode"
        label="스티커 자산 처리"
        description={description("assets-stickerAssetMode")}
      >
        <OptionSelectField
          inputId="assets-stickerAssetMode"
          value={options.assets.stickerAssetMode}
          options={[
            { value: "ignore", label: "무시" },
            { value: "download-original", label: "원본 자산 다운로드" },
          ]}
          onValueChange={(stickerAssetMode) =>
            onOptionsChange((current) => ({
              ...current,
              assets: {
                ...current.assets,
                stickerAssetMode,
              },
            }))
          }
        />
      </OptionField>

      <CheckField
        inputId="assets-downloadImages"
        optionKey="assets-downloadImages"
        label="본문 이미지 다운로드"
        description={description("assets-downloadImages")}
        checked={options.assets.downloadImages}
        disabled={options.assets.imageHandlingMode !== "download"}
        onChange={(checked) =>
          onOptionsChange((current) => ({
            ...current,
            assets: {
              ...current.assets,
              downloadImages: checked,
            },
          }))
        }
      />

      <CheckField
        inputId="assets-downloadThumbnails"
        optionKey="assets-downloadThumbnails"
        label="썸네일 다운로드"
        description={description("assets-downloadThumbnails")}
        checked={options.assets.downloadThumbnails}
        disabled={options.assets.imageHandlingMode !== "download"}
        onChange={(checked) =>
          onOptionsChange((current) => ({
            ...current,
            assets: {
              ...current.assets,
              downloadThumbnails: checked,
            },
          }))
        }
      />

      <CheckField
        inputId="assets-includeImageCaptions"
        optionKey="assets-includeImageCaptions"
        label="이미지 캡션 포함"
        description={description("assets-includeImageCaptions")}
        checked={options.assets.includeImageCaptions}
        onChange={(checked) =>
          onOptionsChange((current) => ({
            ...current,
            assets: {
              ...current.assets,
              includeImageCaptions: checked,
            },
          }))
        }
      />

      <OptionField
        optionKey="assets-thumbnailSource"
        labelFor="assets-thumbnailSource"
        label="썸네일 기준"
        description={description("assets-thumbnailSource")}
      >
        <OptionSelectField
          inputId="assets-thumbnailSource"
          value={options.assets.thumbnailSource}
          options={[
            { value: "post-list-first", label: "글 목록 대표 썸네일 사용" },
            { value: "first-body-image", label: "본문 첫 이미지 사용" },
            { value: "none", label: "썸네일 값 저장 안 함" },
          ]}
          onValueChange={(thumbnailSource) =>
            onOptionsChange((current) => ({
              ...current,
              assets: {
                ...current.assets,
                thumbnailSource,
              },
            }))
          }
        />
      </OptionField>
    </OptionSection>
  )

  const linksSection = (
    <OptionSection title="같은 블로그 글 링크" note="현재 export 중인 블로그 안의 다른 글 링크 처리 규칙">
      <div className="grid gap-4 xl:col-span-2">
        <RadioField
          inputId="links-sameBlogPostMode-keep-source"
          name="links-sameBlogPostMode"
          optionKey="links-sameBlogPostMode"
          label="원래 네이버 블로그 링크 유지"
          description="같은 블로그 글이어도 기존 네이버 URL을 그대로 둡니다."
          checked={options.links.sameBlogPostMode === "keep-source"}
          onChange={() =>
            onOptionsChange((current) => ({
              ...current,
              links: {
                ...current.links,
                sameBlogPostMode: "keep-source",
              },
            }))
          }
        />

        <RadioField
          inputId="links-sameBlogPostMode-custom-url"
          name="links-sameBlogPostMode"
          optionKey="links-sameBlogPostMode"
          label="export 대상 글이면 커스텀 URL로 바꾸기"
          description={description("links-sameBlogPostMode")}
          checked={options.links.sameBlogPostMode === "custom-url"}
          onChange={() =>
            onOptionsChange((current) => ({
              ...current,
              links: {
                ...current.links,
                sameBlogPostMode: "custom-url",
              },
            }))
          }
        >
          {options.links.sameBlogPostMode === "custom-url" ? (
            <div className="grid gap-3 pl-7">
              <label className="field subtle-panel grid min-h-0 gap-2 rounded-2xl px-4 py-4">
                <span className="text-sm font-semibold text-foreground">URL 템플릿</span>
                <Input
                  id="links-sameBlogPostCustomUrlTemplate"
                  value={options.links.sameBlogPostCustomUrlTemplate}
                  placeholder="https://myblog/{slug}"
                  onChange={(event) =>
                    onOptionsChange((current) => ({
                      ...current,
                      links: {
                        ...current.links,
                        sameBlogPostCustomUrlTemplate: event.target.value,
                      },
                    }))
                  }
                />
                <small className="field-help text-sm leading-6">
                  지원 변수만 치환됩니다. 예: <span className="font-mono text-foreground">https://myblog/{"{category}"}/{"{title}"}</span>
                </small>
              </label>

              <div className="field-card grid gap-3 rounded-2xl px-4 py-4">
                <div className="grid gap-1">
                  <span className="text-sm font-semibold text-foreground">실시간 변환 예시</span>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {linkTemplatePreviewPost
                      ? `${linkTemplatePreviewPost.title} 글을 기준으로 바로 보여줍니다.`
                      : "선택 범위에 글이 있으면 여기에서 실제 변환 결과를 바로 보여줍니다."}
                  </p>
                </div>

                <div className="grid gap-2 text-sm leading-6 text-muted-foreground">
                  <span>현재 템플릿</span>
                  <code className="code-surface break-all px-3 py-2 font-mono text-[0.8125rem] text-foreground">
                    {customUrlTemplate || "(비어 있음)"}
                  </code>
                </div>

                <div className="grid gap-2 text-sm leading-6 text-muted-foreground">
                  <span>변환 결과</span>
                  <code
                    id="links-sameBlogPostCustomUrlPreview"
                    className="code-surface-inverse break-all px-3 py-2 font-mono text-[0.8125rem]"
                  >
                    {customUrlPreview ?? "템플릿을 입력하면 결과가 여기에서 바로 바뀝니다."}
                  </code>
                </div>
              </div>

              <div className="field-card grid gap-3 rounded-2xl px-4 py-4">
                <div className="grid gap-1">
                  <span className="text-sm font-semibold text-foreground">사용 가능한 변수</span>
                  <p className="text-sm leading-6 text-muted-foreground">
                    아래 값은 현재 선택 범위 안의 글 하나를 예시로 바로 계산합니다.
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                    {postTemplateKeys.map((key) => {
                      const meta = linkTemplateVariableMeta[key]
                      const exampleValue = linkTemplatePreviewValues?.[key] ?? "-"

                    return (
                      <div
                        key={key}
                        className="subtle-panel grid gap-2 rounded-2xl px-3 py-3"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="w-fit rounded-md font-mono text-xs">
                            {meta.label}
                          </Badge>
                          <span className="text-sm font-medium text-foreground">{meta.description}</span>
                        </div>
                        <div className="grid gap-1 text-sm leading-6 text-muted-foreground">
                          <span>예시 값</span>
                          <code className="code-surface break-all px-2 py-1 font-mono text-[0.8125rem] text-foreground">
                            {exampleValue}
                          </code>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          ) : null}
        </RadioField>

        <RadioField
          inputId="links-sameBlogPostMode-relative-filepath"
          name="links-sameBlogPostMode"
          optionKey="links-sameBlogPostMode"
          label="export 결과 기준 상대경로 filepath로 바꾸기"
          description="같이 export 된 다른 글이면 현재 Markdown 파일 위치 기준 상대경로로 바꿉니다."
          checked={options.links.sameBlogPostMode === "relative-filepath"}
          onChange={() =>
            onOptionsChange((current) => ({
              ...current,
              links: {
                ...current.links,
                sameBlogPostMode: "relative-filepath",
              },
            }))
          }
        />
      </div>
    </OptionSection>
  )

  const diagnosticsSection = (
    <OptionSection title="진단" note="경고와 실패 처리 기준">
      <OptionField
        optionKey="assets-downloadFailureMode"
        labelFor="assets-downloadFailureMode"
        label="이미지 다운로드 실패 처리"
        description={description("assets-downloadFailureMode")}
        disabled={options.assets.imageHandlingMode === "remote"}
      >
        <OptionSelectField
          inputId="assets-downloadFailureMode"
          value={options.assets.downloadFailureMode}
          disabled={options.assets.imageHandlingMode === "remote"}
          options={[
            { value: "warn-and-use-source", label: "경고 후 원본 URL 유지" },
            { value: "use-source", label: "경고 없이 원본 URL 유지" },
            { value: "warn-and-omit", label: "경고 후 이미지 생략" },
            { value: "omit", label: "경고 없이 이미지 생략" },
          ]}
          onValueChange={(downloadFailureMode) =>
            onOptionsChange((current) => ({
              ...current,
              assets: {
                ...current.assets,
                downloadFailureMode,
              },
            }))
          }
        />
      </OptionField>
    </OptionSection>
  )

  const contentByStep: Record<ExportOptionsStep, ReactNode> = {
    structure: structureSection,
    frontmatter: frontmatterSection,
    markdown: markdownSection,
    assets: assetsSection,
    links: linksSection,
    diagnostics: diagnosticsSection,
  }

  return (
    <Card
      variant="panel"
      className="board-card overflow-hidden"
      id="export-panel"
    >
      <CardContent className="panel-body grid gap-4 p-5">
        <div id="export-form" className="form-stack grid gap-5">
          {contentByStep[step]}
        </div>
      </CardContent>
    </Card>
  )
}
