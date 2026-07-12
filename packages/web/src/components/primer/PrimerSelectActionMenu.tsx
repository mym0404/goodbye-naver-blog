import { ActionList, ActionMenu } from "@primer/react"

type PrimerSelectActionMenuOption<T extends string = string> = {
  value: T
  label: string
  description?: string
  disabled?: boolean
}

type PrimerSelectActionMenuGroup<T extends string = string> = {
  label: string
  options: PrimerSelectActionMenuOption<T>[]
}

const getOptionKey = ({ id, value }: { id: string; value: string }) => `${id}:${value}`

export const PrimerSelectActionMenu = <T extends string>({
  id,
  value,
  options,
  groups,
  disabled = false,
  block = true,
  maxWidth,
  ariaDescribedBy,
  ariaInvalid = false,
  onValueChange,
}: {
  id: string
  value: T
  options?: PrimerSelectActionMenuOption<T>[]
  groups?: PrimerSelectActionMenuGroup<T>[]
  disabled?: boolean
  block?: boolean
  maxWidth?: string
  ariaDescribedBy?: string
  ariaInvalid?: boolean
  onValueChange: (value: T) => void
}) => {
  const normalizedGroups =
    groups ?? (options ? [{ label: "", options }] : ([] as PrimerSelectActionMenuGroup<T>[]))
  const selectedOption = normalizedGroups
    .flatMap((group) => group.options)
    .find((option) => option.value === value)

  const renderItem = (option: PrimerSelectActionMenuOption<T>) => (
    <ActionList.Item
      key={getOptionKey({ id, value: option.value })}
      selected={option.value === value}
      disabled={option.disabled}
      data-slot="select-item"
      data-value={option.value}
      onClick={() => {
        onValueChange(option.value)
      }}
      onSelect={() => {
        onValueChange(option.value)
      }}
    >
      {option.label}
      {option.description ? (
        <ActionList.Description variant="block">{option.description}</ActionList.Description>
      ) : null}
    </ActionList.Item>
  )

  return (
    <ActionMenu>
      <ActionMenu.Button
        id={id}
        disabled={disabled}
        data-value={value}
        aria-invalid={ariaInvalid || undefined}
        {...(ariaDescribedBy ? { "aria-describedby": ariaDescribedBy } : {})}
        sx={{
          "& [data-component='buttonContent']": {
            justifyContent: "flex-start",
          },
          justifyContent: "space-between",
          maxWidth,
          textAlign: "left",
          width: block ? "100%" : undefined,
        }}
      >
        {selectedOption?.label ?? "선택"}
      </ActionMenu.Button>
      <ActionMenu.Overlay width="medium">
        <ActionList selectionVariant="single">
          {normalizedGroups.map((group) =>
            group.label ? (
              <ActionList.Group key={`${id}:${group.label}`}>
                <ActionList.GroupHeading>{group.label}</ActionList.GroupHeading>
                {group.options.map(renderItem)}
              </ActionList.Group>
            ) : (
              group.options.map(renderItem)
            ),
          )}
        </ActionList>
      </ActionMenu.Overlay>
    </ActionMenu>
  )
}
