import { useState, useEffect } from 'react';

export type KeyAction = {
    keycodes: Array<string>;
    action: (forceUpdate?: () => void) => void;
};

type UseKeyPressProps = {
    keyActions: Array<KeyAction> | undefined
    isDisabled: boolean;
    forceUpdate: () => void;
};

export const useKeyPress = ({ keyActions, isDisabled, forceUpdate }: UseKeyPressProps) => {
    const [actionLookup, setActionLookup] = useState(new Map<string, (forceUpdate?: () => void) => void>());
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
        if (!actionLookup || !actionLookup.size || !forceUpdate) return;
        const handler = ({ code }: KeyboardEvent) => {
            if (isDisabled) return; // disable ALL keys...
            if (actionLookup.has(code)) {
                const doAction = actionLookup.get(code);
                if (doAction) doAction(forceUpdate);
            }
        };
        window.addEventListener("keyup", e => handler(e));
        return () => {
            window.removeEventListener("keyup", e => handler(e));
        };
    }, [isDisabled, actionLookup, forceUpdate]);
};