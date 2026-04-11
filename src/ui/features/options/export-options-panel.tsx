import type { ReactNode } from "react"

import type {
  ExportOptions,
  FrontmatterFieldMeta,
  FrontmatterFieldName,
  OptionDescriptionMap,
} from "../../../shared/types.js"

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
import { Input } from "../../components/ui/input.js"
import { Separator } from "../../components/ui/separator.js"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs.js"
import type { ExportPreviewResult } from "../../lib/api.js"
import { PreviewPanel } from "../preview/preview-panel.js"

const OptionField = ({
  optionKey,
  label,
  description,
  children,
}: {
  optionKey: string
  label: string
  description?: string
  children: ReactNode
}) => (
  <label className="field" data-option-key={optionKey}>
    <span>{label}</span>
    {children}
    {description ? <small className="field-help">{description}</small> : null}
  </label>
)

const CheckField = ({
  optionKey,
  label,
  description,
  children,
}: {
  optionKey: string
  label: string
  description?: string
  children: ReactNode
}) => (
  <label className="check" data-option-key={optionKey}>
    {children}
    <span>{label}</span>
    {description ? <small className="field-help">{description}</small> : null}
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
  <section className="option-section">
    <div className="option-section-header">
      <div>
        <h3>{title}</h3>
        <p>{note}</p>
      </div>
    </div>
    <div className="option-grid">{children}</div>
  </section>
)

export const ExportOptionsPanel = ({
  outputDir,
  options,
  optionDescriptions,
  frontmatterFieldOrder,
  frontmatterFieldMeta,
  frontmatterValidationErrors,
  preview,
  previewDirty,
  previewStatus,
  previewMode,
  previewPending,
  exportPending,
  disabled,
  onOutputDirChange,
  onOptionsChange,
  onPreview,
  onPreviewModeChange,
  onSubmit,
}: {
  outputDir: string
  options: ExportOptions
  optionDescriptions: OptionDescriptionMap
  frontmatterFieldOrder: FrontmatterFieldName[]
  frontmatterFieldMeta: Record<FrontmatterFieldName, FrontmatterFieldMeta>
  frontmatterValidationErrors: string[]
  preview: ExportPreviewResult | null
  previewDirty: boolean
  previewStatus: string
  previewMode: "source" | "split" | "rendered"
  previewPending: boolean
  exportPending: boolean
  disabled: boolean
  onOutputDirChange: (value: string) => void
  onOptionsChange: (updater: (current: ExportOptions) => ExportOptions) => void
  onPreview: () => void
  onPreviewModeChange: (mode: "source" | "split" | "rendered") => void
  onSubmit: () => void
}) => {
  const description = (key: string) => optionDescriptions[key]

  return (
    <Card className="board-card" id="export-panel">
      <CardHeader className="panel-header">
        <div className="panel-heading">
          <p className="section-kicker">Stage 2</p>
          <CardTitle className="section-title">출력 설정</CardTitle>
        </div>
        <CardDescription className="panel-description">
          구조, frontmatter, Markdown, asset 규칙을 semantic token과 shadcn 카드 계층으로 조정합니다.
        </CardDescription>
      </CardHeader>

      <CardContent className="panel-body">
        <form
          id="export-form"
          className="form-stack"
          onSubmit={(event) => {
            event.preventDefault()
            onSubmit()
          }}
        >
          <div className="control-bar">
            <label className="field control-field">
              <span>출력 경로</span>
              <Input id="outputDir" value={outputDir} required onChange={(event) => onOutputDirChange(event.target.value)} />
            </label>

            <div className="export-actions">
              <Button type="submit" id="export-button" size="lg" disabled={disabled || exportPending}>
                <i className={`${exportPending ? "ri-loader-4-line motion-safe:animate-spin" : "ri-download-2-line"}`} aria-hidden="true" />
                {exportPending ? "작업 등록 중" : "선택한 카테고리 내보내기"}
              </Button>
            </div>
          </div>

          <PreviewPanel
            preview={preview}
            previewDirty={previewDirty}
            previewStatus={previewStatus}
            previewMode={previewMode}
            disabled={disabled}
            pending={previewPending}
            onPreview={onPreview}
            onPreviewModeChange={onPreviewModeChange}
          />

          <Tabs className="option-tabs" defaultValue="structure">
            <TabsList className="option-tabs-list">
              <TabsTrigger value="scope">
                <i className="ri-focus-3-line" aria-hidden="true" />
                범위
              </TabsTrigger>
              <TabsTrigger value="structure">
                <i className="ri-layout-grid-line" aria-hidden="true" />
                구조
              </TabsTrigger>
              <TabsTrigger value="markdown">
                <i className="ri-markdown-line" aria-hidden="true" />
                Markdown
              </TabsTrigger>
              <TabsTrigger value="assets">
                <i className="ri-image-2-line" aria-hidden="true" />
                Assets
              </TabsTrigger>
            </TabsList>

            <TabsContent value="scope" className="option-tab-panel">
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

            <TabsContent value="structure" className="option-tab-panel">
              <div className="option-tab-stack">
                <OptionSection title="Structure" note="Output folders and file naming">
                  <CheckField
                    optionKey="structure-cleanOutputDir"
                    label="Export 전에 output 디렉터리 재생성"
                    description={description("structure-cleanOutputDir")}
                  >
                    <input
                      id="structure-cleanOutputDir"
                      type="checkbox"
                      checked={options.structure.cleanOutputDir}
                      onChange={(event) =>
                        onOptionsChange((current) => ({
                          ...current,
                          structure: {
                            ...current.structure,
                            cleanOutputDir: event.target.checked,
                          },
                        }))
                      }
                    />
                  </CheckField>

                  <OptionField
                    optionKey="structure-postDirectoryName"
                    label="Post Directory Name"
                    description={description("structure-postDirectoryName")}
                  >
                    <Input
                      id="structure-postDirectoryName"
                      value={options.structure.postDirectoryName}
                      onChange={(event) =>
                        onOptionsChange((current) => ({
                          ...current,
                          structure: {
                            ...current.structure,
                            postDirectoryName: event.target.value,
                          },
                        }))
                      }
                    />
                  </OptionField>

                  <OptionField
                    optionKey="structure-assetDirectoryName"
                    label="Asset Directory Name"
                    description={description("structure-assetDirectoryName")}
                  >
                    <Input
                      id="structure-assetDirectoryName"
                      value={options.structure.assetDirectoryName}
                      onChange={(event) =>
                        onOptionsChange((current) => ({
                          ...current,
                          structure: {
                            ...current.structure,
                            assetDirectoryName: event.target.value,
                          },
                        }))
                      }
                    />
                  </OptionField>

                  <OptionField
                    optionKey="structure-folderStrategy"
                    label="Folder Strategy"
                    description={description("structure-folderStrategy")}
                  >
                    <select
                      id="structure-folderStrategy"
                      value={options.structure.folderStrategy}
                      onChange={(event) =>
                        onOptionsChange((current) => ({
                          ...current,
                          structure: {
                            ...current.structure,
                            folderStrategy: event.target.value as ExportOptions["structure"]["folderStrategy"],
                          },
                        }))
                      }
                    >
                      <option value="category-path">카테고리 폴더 경로 유지</option>
                      <option value="flat">한 폴더에 평탄화</option>
                    </select>
                  </OptionField>

                  <CheckField
                    optionKey="structure-includeDateInFilename"
                    label="파일명에 날짜 포함"
                    description={description("structure-includeDateInFilename")}
                  >
                    <input
                      id="structure-includeDateInFilename"
                      type="checkbox"
                      checked={options.structure.includeDateInFilename}
                      onChange={(event) =>
                        onOptionsChange((current) => ({
                          ...current,
                          structure: {
                            ...current.structure,
                            includeDateInFilename: event.target.checked,
                          },
                        }))
                      }
                    />
                  </CheckField>

                  <CheckField
                    optionKey="structure-includeLogNoInFilename"
                    label="파일명에 logNo 포함"
                    description={description("structure-includeLogNoInFilename")}
                  >
                    <input
                      id="structure-includeLogNoInFilename"
                      type="checkbox"
                      checked={options.structure.includeLogNoInFilename}
                      onChange={(event) =>
                        onOptionsChange((current) => ({
                          ...current,
                          structure: {
                            ...current.structure,
                            includeLogNoInFilename: event.target.checked,
                          },
                        }))
                      }
                    />
                  </CheckField>

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

                <OptionSection title="Frontmatter" note="Metadata envelope">
                  <div className="frontmatter-toolbar">
                    <CheckField
                      optionKey="frontmatter-enabled"
                      label="Frontmatter 사용"
                      description={description("frontmatter-enabled")}
                    >
                      <input
                        id="frontmatter-enabled"
                        type="checkbox"
                        checked={options.frontmatter.enabled}
                        onChange={(event) =>
                          onOptionsChange((current) => ({
                            ...current,
                            frontmatter: {
                              ...current.frontmatter,
                              enabled: event.target.checked,
                            },
                          }))
                        }
                      />
                    </CheckField>
                    <Badge variant={frontmatterValidationErrors.length > 0 ? "destructive" : "secondary"}>
                      {frontmatterValidationErrors.length > 0 ? "alias 오류" : "정상"}
                    </Badge>
                  </div>

                  <Alert
                    id="frontmatter-status"
                    className="frontmatter-alert"
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

                  <div id="frontmatter-fields" className="frontmatter-grid">
                    {frontmatterFieldOrder.map((fieldName) => {
                      const fieldMeta = frontmatterFieldMeta[fieldName]
                      const fieldEnabled = options.frontmatter.fields[fieldName]
                      const hasError = frontmatterValidationErrors.some((error) => error.includes(fieldName))

                      return (
                        <div
                          key={fieldName}
                          className="frontmatter-row"
                          data-frontmatter-field={fieldName}
                          data-state={hasError ? "error" : "default"}
                        >
                          <div className="frontmatter-main">
                            <label className="frontmatter-toggle">
                              <input
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
                              <span>{fieldMeta.label}</span>
                            </label>
                            <p className="frontmatter-description">{fieldMeta.description}</p>
                          </div>
                          <label className="field frontmatter-alias-field">
                            <span>Export Key Alias</span>
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
              </div>
            </TabsContent>

            <TabsContent value="markdown" className="option-tab-panel">
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
                  optionKey="markdown-linkCardStyle"
                  label="Link Card Style"
                  description={description("markdown-linkCardStyle")}
                >
                  <select
                    id="markdown-linkCardStyle"
                    value={options.markdown.linkCardStyle === "html" ? "inline" : options.markdown.linkCardStyle}
                    onChange={(event) =>
                      onOptionsChange((current) => ({
                        ...current,
                        markdown: {
                          ...current.markdown,
                          linkCardStyle: event.target.value as ExportOptions["markdown"]["linkCardStyle"],
                        },
                      }))
                    }
                  >
                    <option value="inline">inline link + description</option>
                    <option value="quote">blockquote card</option>
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

                <OptionField optionKey="markdown-videoStyle" label="Video Style" description={description("markdown-videoStyle")}>
                  <select
                    id="markdown-videoStyle"
                    value={options.markdown.videoStyle === "html" ? "thumbnail-link" : options.markdown.videoStyle}
                    onChange={(event) =>
                      onOptionsChange((current) => ({
                        ...current,
                        markdown: {
                          ...current.markdown,
                          videoStyle: event.target.value as ExportOptions["markdown"]["videoStyle"],
                        },
                      }))
                    }
                  >
                    <option value="thumbnail-link">썸네일 + 원문 링크</option>
                    <option value="link-only">링크만</option>
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

            <TabsContent value="assets" className="option-tab-panel">
              <OptionSection title="Assets" note="Download and reference strategy">
                <OptionField
                  optionKey="assets-assetPathMode"
                  label="Asset Path Mode"
                  description={description("assets-assetPathMode")}
                >
                  <select
                    id="assets-assetPathMode"
                    value={options.assets.assetPathMode}
                    onChange={(event) =>
                      onOptionsChange((current) => ({
                        ...current,
                        assets: {
                          ...current.assets,
                          assetPathMode: event.target.value as ExportOptions["assets"]["assetPathMode"],
                        },
                      }))
                    }
                  >
                    <option value="relative">로컬 상대경로</option>
                    <option value="remote">원격 URL 유지</option>
                  </select>
                </OptionField>

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
                  optionKey="assets-downloadImages"
                  label="본문 이미지 다운로드"
                  description={description("assets-downloadImages")}
                >
                  <input
                    id="assets-downloadImages"
                    type="checkbox"
                    checked={options.assets.downloadImages}
                    onChange={(event) =>
                      onOptionsChange((current) => ({
                        ...current,
                        assets: {
                          ...current.assets,
                          downloadImages: event.target.checked,
                        },
                      }))
                    }
                  />
                </CheckField>

                <CheckField
                  optionKey="assets-downloadThumbnails"
                  label="썸네일 다운로드"
                  description={description("assets-downloadThumbnails")}
                >
                  <input
                    id="assets-downloadThumbnails"
                    type="checkbox"
                    checked={options.assets.downloadThumbnails}
                    onChange={(event) =>
                      onOptionsChange((current) => ({
                        ...current,
                        assets: {
                          ...current.assets,
                          downloadThumbnails: event.target.checked,
                        },
                      }))
                    }
                  />
                </CheckField>

                <CheckField
                  optionKey="assets-includeImageCaptions"
                  label="이미지 캡션 포함"
                  description={description("assets-includeImageCaptions")}
                >
                  <input
                    id="assets-includeImageCaptions"
                    type="checkbox"
                    checked={options.assets.includeImageCaptions}
                    onChange={(event) =>
                      onOptionsChange((current) => ({
                        ...current,
                        assets: {
                          ...current.assets,
                          includeImageCaptions: event.target.checked,
                        },
                      }))
                    }
                  />
                </CheckField>

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
        </form>
      </CardContent>
    </Card>
  )
}
