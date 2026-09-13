import { Label, Switch } from '@heroui/react';

export function RecipeToggleButton({ show, onToggle }: { show: boolean; onToggle: () => void }) {
    return (
        <Switch isSelected={show} onChange={onToggle} className="justify-between">
            <Label className="text-xs font-bold  tracking-wider text-gray-400">
              Xem công thức
            </Label>
            <Switch.Control>
                <Switch.Thumb />
            </Switch.Control>
        </Switch>
    )
}