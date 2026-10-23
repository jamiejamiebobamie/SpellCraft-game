import { useState, useEffect } from 'react';

export type KeyAction = {
    keycodes: Array<string>;
    action: () => void;
};

type UseKeyPressProps = {
    keyActions: Array<KeyAction> | undefined
    isDisabled: boolean;
};

export const useKeyPress = ({ keyActions, isDisabled }: UseKeyPressProps) => {
    const [actionLookup, setActionLookup] = useState(new Map<string, () => void>());
    useEffect(() => {
        if (keyActions) {
            const actionLookup = new Map<string, () => void>();
            keyActions.forEach(({
                keycodes,
                action
            }) => keycodes.forEach(k => actionLookup.set(k, action)));
            setActionLookup(actionLookup);
        }
    }, [keyActions]);
    useEffect(() => {
        if (!actionLookup || !actionLookup.size) return;
        const handler = ({ code }: KeyboardEvent) => {
            if (isDisabled) return; // disable ALL keys...
            if (actionLookup.has(code)) {
                const doAction = actionLookup.get(code);
                if (doAction) doAction();
            }
        };
        window.addEventListener("keyup", handler);
        return () => window.removeEventListener("keyup", handler);
    }, [isDisabled, actionLookup]);
};