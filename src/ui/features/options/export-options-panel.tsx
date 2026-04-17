import type { ReactNode } from "react"

import type {
  ExportOptions,
  FrontmatterFieldMeta,
  FrontmatterFieldName,
  OptionDescriptionMap,
} from "../../../shared/types.js"

import { Alert, AlertDescription, AlertTitle } from "../../components/ui/alert.js"
import { Badge } from "../../components/ui/badge.js"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card.js"
import { Input } from "../../components/ui/input.js"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs.js"

const OptionField = ({
  optionKey,
  label,
  description,
  children,
  disabled = false,
}: {
  optionKey: string
  label: string
  description?: string
  children: ReactNode
  disabled?: boolean
}) => (
  <label
    className={`field grid min-h-[7.75rem] gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-[0_12px_30px_rgba(22,33,50,0.04)] ${disabled ? "opacity-60" : ""}`}
    data-option-key={optionKey}
    aria-disabled={disabled}
  >
    <span className="text-sm font-semibold text-slate-900">{label}</span>
    {children}
    {description ? <small className="field-help text-sm leading-6 text-slate-500">{description}</small> : null}
  </label>
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
    className={`check flex flex-col rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-[0_12px_30px_rgba(22,33,50,0.04)] ${compact ? "min-h-0 gap-2" : "min-h-[7.75rem] gap-3"} ${disabled ? "opacity-60" : ""}`}
    data-option-key={optionKey}
    aria-disabled={disabled}
  >
    <span className={`check-head flex gap-3 ${compact ? "items-center" : "items-start"}`}>
      <input
        id={inputId}
        className="mt-0.5 size-[1.1rem] shrink-0 accent-primary"
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="check-copy grid min-w-0 gap-1">
        <span className="check-title text-sm font-semibold text-slate-900">{label}</span>
      </span>
    </span>
    {description ? <small className="field-help text-sm leading-6 text-slate-500">{description}</small> : null}
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
  <section className="option-section grid gap-4 rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-4">
    <div className="option-section-header flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h3 className="text-lg font-semibold tracking-[-0.03em] text-slate-900">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-slate-500">{note}</p>
      </div>
    </div>
    <div className="option-grid grid gap-4 xl:grid-cols-2">{children}</div>
  </section>
)

export const ExportOptionsPanel = ({
  outputDir,
  options,
  optionDescriptions,
  frontmatterFieldOrder,
  frontmatterFieldMeta,
  frontmatterValidationErrors,
  onOutputDirChange,
  onOptionsChange,
}: {
  outputDir: string
  options: ExportOptions
  optionDescriptions: OptionDescriptionMap
  frontmatterFieldOrder: FrontmatterFieldName[]
  frontmatterFieldMeta: Record<FrontmatterFieldName, FrontmatterFieldMeta>
  frontmatterValidationErrors: string[]
  onOutputDirChange: (value: string) => void
  onOptionsChange: (updater: (current: ExportOptions) => ExportOptions) => void
}) => {
  const description = (key: string) => optionDescriptions[key]
  const isBase64Embedding = options.assets.imageContentMode === "base64"
  const frontmatterSection = (
    <OptionSection title="Frontmatter" note="Metadata envelope">
      <div className="frontmatter-toolbar grid gap-3 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
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
          className={`frontmatter-state-card flex min-h-0 flex-col justify-between gap-3 rounded-2xl border bg-white px-4 py-4 shadow-[0_12px_30px_rgba(22,33,50,0.04)] sm:flex-row sm:items-start ${frontmatterValidationErrors.length > 0 ? "border-rose-200" : "border-slate-200"}`}
          data-state={frontmatterValidationErrors.length > 0 ? "error" : "default"}
        >
          <div className="frontmatter-state-copy grid min-w-0 gap-2">
            <span className="frontmatter-state-label text-sm font-semibold text-slate-900">Alias 상태</span>
            <p className="frontmatter-description text-sm leading-6 text-slate-500">
              {frontmatterValidationErrors.length > 0
                ? "중복 또는 비어 있는 alias를 먼저 정리해야 export와 preview가 다시 활성화됩니다."
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

      <Alert
        id="frontmatter-status"
        className="frontmatter-alert rounded-2xl border-slate-200 bg-white px-4 py-4"
        data-state={frontmatterValidationErrors.length > 0 ? "error" : "default"}
        variant={frontmatterValidationErrors.length > 0 ? "destructive" : "default"}
      >
        <AlertTitle>Frontmatter key alias</AlertTitle>
        <AlertDescription>
          {frontmatterValidationErrors.length > 0
            ? frontmatterValidationErrors.join(" ")
            : "각 필드의 설명과 export key alias를 여기서 조정합니다."}
        </AlertDescription>
      </Alert>

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
              className={`frontmatter-row grid content-start gap-4 rounded-2xl border bg-white px-4 py-4 shadow-[0_12px_30px_rgba(22,33,50,0.04)] ${hasError ? "border-rose-200 ring-1 ring-rose-100" : "border-slate-200"}`}
              data-frontmatter-field={fieldName}
              data-state={hasError ? "error" : "default"}
            >
              <div className="frontmatter-main grid gap-3">
                <label className="frontmatter-toggle inline-flex items-start gap-3">
                  <input
                    id={`frontmatter-field-${fieldName}`}
                    className="mt-0.5 size-[1.1rem] shrink-0 accent-primary"
                    type="checkbox"
                    value={fieldName}
                    checked={fieldEnabled}
                    onChange={(event) =>
                      onOptionsChange((current) => ({
                        ...current,
                        frontmatter: {
                          ...current.frontmatter,
                          fields: {
                            ...current.frontmatter.fields,
                            [fieldName]: event.target.checked,
                          },
                        },
                      }))
                    }
                  />
                  <span className="frontmatter-toggle-copy grid gap-1">
                    <span className="text-sm font-semibold text-slate-900">{fieldMeta.label}</span>
                    <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">{fieldName}</span>
                  </span>
                </label>
                <p className="frontmatter-description text-sm leading-6 text-slate-500">{fieldMeta.description}</p>
              </div>
              <label className="field frontmatter-alias-field grid min-h-0 gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4">
                <span className="text-sm font-semibold text-slate-900">Export Key Alias</span>
                <Input
                  data-alias-input="true"
                  data-field-name={fieldName}
                  value={options.frontmatter.aliases[fieldName] ?? ""}
                  placeholder={fieldMeta.defaultAlias}
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

  return (
    <Card
      className="board-card overflow-hidden border-white/80 bg-white/90 shadow-[0_24px_60px_rgba(22,33,50,0.08)] backdrop-blur"
      id="export-panel"
    >
      <CardHeader className="panel-header gap-4 border-b border-slate-200/70 bg-white/70 p-6 sm:flex sm:items-start sm:justify-between">
        <div className="panel-heading space-y-2">
          <CardTitle className="section-title text-2xl font-semibold tracking-[-0.04em] text-slate-900">
            출력 설정
          </CardTitle>
        </div>
        <CardDescription className="panel-description max-w-3xl text-sm leading-7 text-slate-600">
          내보내기 규칙을 설정합니다.
        </CardDescription>
      </CardHeader>

      <CardContent className="panel-body grid gap-5 p-6">
        <div id="export-form" className="form-stack grid gap-5">
          <div className="control-bar grid">
            <label className="field control-field grid min-h-0 gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-[0_12px_30px_rgba(22,33,50,0.04)]">
              <span className="text-sm font-semibold text-slate-900">출력 경로</span>
              <Input id="outputDir" value={outputDir} required onChange={(event) => onOutputDirChange(event.target.value)} />
              <small className="field-help text-sm leading-6 text-slate-500">결과를 저장할 위치입니다.</small>
            </label>
          </div>

          <Tabs className="option-tabs grid gap-4" defaultValue="structure">
            <TabsList className="option-tabs-list grid h-auto w-full grid-cols-2 gap-2 rounded-2xl bg-slate-100/90 p-1.5 sm:grid-cols-5">
              <TabsTrigger value="scope" className="min-h-12 rounded-xl px-4 py-3 text-sm font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm">
                범위
              </TabsTrigger>
              <TabsTrigger value="structure" className="min-h-12 rounded-xl px-4 py-3 text-sm font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm">
                구조
              </TabsTrigger>
              <TabsTrigger value="frontmatter" className="min-h-12 rounded-xl px-4 py-3 text-sm font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm">
                Frontmatter
              </TabsTrigger>
              <TabsTrigger value="markdown" className="min-h-12 rounded-xl px-4 py-3 text-sm font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm">
                Markdown
              </TabsTrigger>
              <TabsTrigger value="assets" className="min-h-12 rounded-xl px-4 py-3 text-sm font-semibold data-[state=active]:bg-white data-[state=active]:shadow-sm">
                Assets
              </TabsTrigger>
            </TabsList>

            <TabsContent value="scope" className="option-tab-panel mt-0">
              <OptionSection title="Scope" note="Selection and date window">
                <OptionField
                  optionKey="scope-categoryMode"
                  label="Category Match Mode"
                  description={description("scope-categoryMode")}
                >
                  <select
                    id="scope-categoryMode"
                    value={options.scope.categoryMode}
                    onChange={(event) =>
                      onOptionsChange((current) => ({
                        ...current,
                        scope: {
                          ...current.scope,
                          categoryMode: event.target.value as ExportOptions["scope"]["categoryMode"],
                        },
                      }))
                    }
                  >
                    <option value="selected-and-descendants">선택 카테고리 + 하위 카테고리</option>
                    <option value="exact-selected">선택 카테고리만</option>
                  </select>
                </OptionField>

                <OptionField optionKey="scope-dateFrom" label="Date From" description={description("scope-dateFrom")}>
                  <Input
                    id="scope-dateFrom"
                    type="date"
                    value={options.scope.dateFrom ?? ""}
                    onChange={(event) =>
                      onOptionsChange((current) => ({
                        ...current,
                        scope: {
                          ...current.scope,
                          dateFrom: event.target.value || null,
                        },
                      }))
                    }
                  />
                </OptionField>

                <OptionField optionKey="scope-dateTo" label="Date To" description={description("scope-dateTo")}>
                  <Input
                    id="scope-dateTo"
                    type="date"
                    value={options.scope.dateTo ?? ""}
                    onChange={(event) =>
                      onOptionsChange((current) => ({
                        ...current,
                        scope: {
                          ...current.scope,
                          dateTo: event.target.value || null,
                        },
                      }))
                    }
                  />
                </OptionField>
              </OptionSection>
            </TabsContent>

            <TabsContent value="structure" className="option-tab-panel mt-0">
              <OptionSection title="Structure" note="Output folders and file naming">
                <CheckField
                  inputId="structure-cleanOutputDir"
                  optionKey="structure-cleanOutputDir"
                  label="Export 전에 output 디렉터리 재생성"
                  description={description("structure-cleanOutputDir")}
                  checked={options.structure.cleanOutputDir}
                  onChange={(checked) =>
                    onOptionsChange((current) => ({
                      ...current,
                      structure: {
                        ...current.structure,
                        cleanOutputDir: checked,
                      },
                    }))
                  }
                />

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

                <OptionField optionKey="structure-slugStyle" label="Slug Style" description={description("structure-slugStyle")}>
                  <select
                    id="structure-slugStyle"
                    value={options.structure.slugStyle}
                    onChange={(event) =>
                      onOptionsChange((current) => ({
                        ...current,
                        structure: {
                          ...current.structure,
                          slugStyle: event.target.value as ExportOptions["structure"]["slugStyle"],
                        },
                      }))
                    }
                  >
                    <option value="kebab">kebab-case</option>
                    <option value="keep-title">원본 제목 유지</option>
                  </select>
                </OptionField>
              </OptionSection>
            </TabsContent>

            <TabsContent value="frontmatter" className="option-tab-panel mt-0">
              {frontmatterSection}
            </TabsContent>

            <TabsContent value="markdown" className="option-tab-panel mt-0">
              <OptionSection title="Markdown Rules" note="Links, media, code and tables">
                <OptionField optionKey="markdown-linkStyle" label="Link Style" description={description("markdown-linkStyle")}>
                  <select
                    id="markdown-linkStyle"
                    value={options.markdown.linkStyle}
                    onChange={(event) =>
                      onOptionsChange((current) => ({
                        ...current,
                        markdown: {
                          ...current.markdown,
                          linkStyle: event.target.value as ExportOptions["markdown"]["linkStyle"],
                        },
                      }))
                    }
                  >
                    <option value="inlined">inline links</option>
                    <option value="referenced">reference links</option>
                  </select>
                </OptionField>

                <OptionField
                  optionKey="markdown-formulaInlineWrapperOpen"
                  label="Inline Formula Open"
                  description={description("markdown-formulaInlineWrapperOpen")}
                >
                  <Input
                    id="markdown-formulaInlineWrapperOpen"
                    value={options.markdown.formulaInlineWrapperOpen}
                    onChange={(event) =>
                      onOptionsChange((current) => ({
                        ...current,
                        markdown: {
                          ...current.markdown,
                          formulaInlineWrapperOpen: event.target.value,
                        },
                      }))
                    }
                  />
                </OptionField>

                <OptionField
                  optionKey="markdown-formulaInlineWrapperClose"
                  label="Inline Formula Close"
                  description={description("markdown-formulaInlineWrapperClose")}
                >
                  <Input
                    id="markdown-formulaInlineWrapperClose"
                    value={options.markdown.formulaInlineWrapperClose}
                    onChange={(event) =>
                      onOptionsChange((current) => ({
                        ...current,
                        markdown: {
                          ...current.markdown,
                          formulaInlineWrapperClose: event.target.value,
                        },
                      }))
                    }
                  />
                </OptionField>

                <OptionField
                  optionKey="markdown-formulaBlockStyle"
                  label="Block Formula Style"
                  description={description("markdown-formulaBlockStyle")}
                >
                  <select
                    id="markdown-formulaBlockStyle"
                    value={options.markdown.formulaBlockStyle}
                    onChange={(event) =>
                      onOptionsChange((current) => ({
                        ...current,
                        markdown: {
                          ...current.markdown,
                          formulaBlockStyle: event.target.value as ExportOptions["markdown"]["formulaBlockStyle"],
                        },
                      }))
                    }
                  >
                    <option value="wrapper">custom wrapper</option>
                    <option value="math-fence">```math fence</option>
                  </select>
                </OptionField>

                <OptionField
                  optionKey="markdown-formulaBlockWrapperOpen"
                  label="Block Formula Open"
                  description={description("markdown-formulaBlockWrapperOpen")}
                >
                  <Input
                    id="markdown-formulaBlockWrapperOpen"
                    value={options.markdown.formulaBlockWrapperOpen}
                    onChange={(event) =>
                      onOptionsChange((current) => ({
                        ...current,
                        markdown: {
                          ...current.markdown,
                          formulaBlockWrapperOpen: event.target.value,
                        },
                      }))
                    }
                  />
                </OptionField>

                <OptionField
                  optionKey="markdown-formulaBlockWrapperClose"
                  label="Block Formula Close"
                  description={description("markdown-formulaBlockWrapperClose")}
                >
                  <Input
                    id="markdown-formulaBlockWrapperClose"
                    value={options.markdown.formulaBlockWrapperClose}
                    onChange={(event) =>
                      onOptionsChange((current) => ({
                        ...current,
                        markdown: {
                          ...current.markdown,
                          formulaBlockWrapperClose: event.target.value,
                        },
                      }))
                    }
                  />
                </OptionField>

                <OptionField optionKey="markdown-tableStyle" label="Table Style" description={description("markdown-tableStyle")}>
                  <select
                    id="markdown-tableStyle"
                    value={options.markdown.tableStyle}
                    onChange={(event) =>
                      onOptionsChange((current) => ({
                        ...current,
                        markdown: {
                          ...current.markdown,
                          tableStyle: event.target.value as ExportOptions["markdown"]["tableStyle"],
                        },
                      }))
                    }
                  >
                    <option value="gfm-or-html">Markdown 우선, 복잡한 표는 best-effort 변환</option>
                  </select>
                </OptionField>

                <OptionField optionKey="markdown-imageStyle" label="Image Style" description={description("markdown-imageStyle")}>
                  <select
                    id="markdown-imageStyle"
                    value={options.markdown.imageStyle}
                    onChange={(event) =>
                      onOptionsChange((current) => ({
                        ...current,
                        markdown: {
                          ...current.markdown,
                          imageStyle: event.target.value as ExportOptions["markdown"]["imageStyle"],
                        },
                      }))
                    }
                  >
                    <option value="markdown-image">일반 Markdown 이미지</option>
                    <option value="linked-image">이미지를 원본 링크로 감싸기</option>
                    <option value="source-only">링크만 남기기</option>
                  </select>
                </OptionField>

                <OptionField
                  optionKey="markdown-imageGroupStyle"
                  label="Image Group Style"
                  description={description("markdown-imageGroupStyle")}
                >
                  <select
                    id="markdown-imageGroupStyle"
                    value={options.markdown.imageGroupStyle === "html" ? "split-images" : options.markdown.imageGroupStyle}
                    onChange={(event) =>
                      onOptionsChange((current) => ({
                        ...current,
                        markdown: {
                          ...current.markdown,
                          imageGroupStyle: event.target.value as ExportOptions["markdown"]["imageGroupStyle"],
                        },
                      }))
                    }
                  >
                    <option value="split-images">개별 이미지로 분해</option>
                  </select>
                </OptionField>

                <OptionField
                  optionKey="markdown-dividerStyle"
                  label="Divider Style"
                  description={description("markdown-dividerStyle")}
                >
                  <select
                    id="markdown-dividerStyle"
                    value={options.markdown.dividerStyle}
                    onChange={(event) =>
                      onOptionsChange((current) => ({
                        ...current,
                        markdown: {
                          ...current.markdown,
                          dividerStyle: event.target.value as ExportOptions["markdown"]["dividerStyle"],
                        },
                      }))
                    }
                  >
                    <option value="dash">---</option>
                    <option value="asterisk">***</option>
                  </select>
                </OptionField>

                <OptionField
                  optionKey="markdown-codeFenceStyle"
                  label="Code Fence Style"
                  description={description("markdown-codeFenceStyle")}
                >
                  <select
                    id="markdown-codeFenceStyle"
                    value={options.markdown.codeFenceStyle}
                    onChange={(event) =>
                      onOptionsChange((current) => ({
                        ...current,
                        markdown: {
                          ...current.markdown,
                          codeFenceStyle: event.target.value as ExportOptions["markdown"]["codeFenceStyle"],
                        },
                      }))
                    }
                  >
                    <option value="backtick">```</option>
                    <option value="tilde">~~~</option>
                  </select>
                </OptionField>

                <OptionField
                  optionKey="markdown-headingLevelOffset"
                  label="Heading Level Offset"
                  description={description("markdown-headingLevelOffset")}
                >
                  <Input
                    id="markdown-headingLevelOffset"
                    type="number"
                    min="-2"
                    max="3"
                    value={options.markdown.headingLevelOffset}
                    onChange={(event) =>
                      onOptionsChange((current) => ({
                        ...current,
                        markdown: {
                          ...current.markdown,
                          headingLevelOffset: Number(event.target.value || "0"),
                        },
                      }))
                    }
                  />
                </OptionField>
              </OptionSection>
            </TabsContent>

            <TabsContent value="assets" className="option-tab-panel mt-0">
              <OptionSection title="Assets" note="Download and reference strategy">
                <OptionField
                  optionKey="assets-imageHandlingMode"
                  label="이미지 처리 방식"
                  description={description("assets-imageHandlingMode")}
                >
                  <select
                    id="assets-imageHandlingMode"
                    value={options.assets.imageHandlingMode}
                    onChange={(event) =>
                      onOptionsChange((current) => ({
                        ...current,
                        assets: {
                          ...current.assets,
                          imageHandlingMode:
                            event.target.value as ExportOptions["assets"]["imageHandlingMode"],
                          compressionEnabled:
                            event.target.value === "remote" ? false : current.assets.compressionEnabled,
                          downloadImages:
                            event.target.value === "remote"
                              ? false
                              : event.target.value === "download-and-upload"
                                ? true
                                : current.assets.downloadImages,
                          downloadThumbnails:
                            event.target.value === "remote"
                              ? false
                              : event.target.value === "download-and-upload"
                                ? true
                                : current.assets.downloadThumbnails,
                        },
                      }))
                    }
                  >
                    <option value="download">다운로드 유지</option>
                    <option value="remote">네이버 원본 URL 유지</option>
                    <option value="download-and-upload">다운로드 후 PicGo 업로드</option>
                  </select>
                </OptionField>

                <CheckField
                  inputId="assets-compressionEnabled"
                  optionKey="assets-compressionEnabled"
                  label="로컬 이미지 압축"
                  description={description("assets-compressionEnabled")}
                  checked={options.assets.compressionEnabled}
                  disabled={isBase64Embedding || options.assets.imageHandlingMode === "remote"}
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
                  optionKey="assets-imageContentMode"
                  label="Image Content Mode"
                  description={description("assets-imageContentMode")}
                >
                  <select
                    id="assets-imageContentMode"
                    value={options.assets.imageContentMode}
                    onChange={(event) =>
                      onOptionsChange((current) => ({
                        ...current,
                        assets: {
                          ...current.assets,
                          imageContentMode: event.target.value as ExportOptions["assets"]["imageContentMode"],
                          imageHandlingMode:
                            event.target.value === "base64" ? "download" : current.assets.imageHandlingMode,
                          compressionEnabled:
                            event.target.value === "base64" ? false : current.assets.compressionEnabled,
                          downloadImages:
                            event.target.value === "base64" ? true : current.assets.downloadImages,
                        },
                      }))
                    }
                  >
                    <option value="path">파일 경로 참조</option>
                    <option value="base64">base64 data URL 임베딩</option>
                  </select>
                </OptionField>

                <OptionField
                  optionKey="assets-stickerAssetMode"
                  label="Sticker Asset Mode"
                  description={description("assets-stickerAssetMode")}
                >
                  <select
                    id="assets-stickerAssetMode"
                    value={options.assets.stickerAssetMode}
                    onChange={(event) =>
                      onOptionsChange((current) => ({
                        ...current,
                        assets: {
                          ...current.assets,
                          stickerAssetMode: event.target.value as ExportOptions["assets"]["stickerAssetMode"],
                        },
                      }))
                    }
                  >
                    <option value="ignore">무시</option>
                    <option value="download-original">원본 자산 다운로드</option>
                  </select>
                </OptionField>

                <CheckField
                  inputId="assets-downloadImages"
                  optionKey="assets-downloadImages"
                  label="본문 이미지 다운로드"
                  description={description("assets-downloadImages")}
                  checked={options.assets.downloadImages}
                  disabled={
                    isBase64Embedding || options.assets.imageHandlingMode !== "download"
                  }
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
                  disabled={
                    isBase64Embedding || options.assets.imageHandlingMode !== "download"
                  }
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
                  label="Thumbnail Source"
                  description={description("assets-thumbnailSource")}
                >
                  <select
                    id="assets-thumbnailSource"
                    value={options.assets.thumbnailSource}
                    onChange={(event) =>
                      onOptionsChange((current) => ({
                        ...current,
                        assets: {
                          ...current.assets,
                          thumbnailSource: event.target.value as ExportOptions["assets"]["thumbnailSource"],
                        },
                      }))
                    }
                  >
                    <option value="post-list-first">post-list 썸네일 우선</option>
                    <option value="first-body-image">본문 첫 미디어 우선</option>
                    <option value="none">thumbnail 제외</option>
                  </select>
                </OptionField>
              </OptionSection>
            </TabsContent>
          </Tabs>
        </div>
      </CardContent>
    </Card>
  )
}
