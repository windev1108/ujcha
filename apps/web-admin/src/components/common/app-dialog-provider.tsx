"use client";

import { Button, Modal, useOverlayState } from "@heroui/react";
import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
};

type ConfirmPending = ConfirmOptions & { resolve: (v: boolean) => void };
type AlertPending = { message: string; title?: string; resolve: () => void };

type Ctx = {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  /** Thay cho `window.alert` — tránh trùng tên với hàm global `alert`. */
  showAlert: (message: string, title?: string) => Promise<void>;
};

const AppDialogContext = createContext<Ctx | null>(null);

export function useAppDialog(): Ctx {
  const v = useContext(AppDialogContext);
  if (!v) {
    throw new Error("useAppDialog must be used within AppDialogProvider");
  }
  return v;
}

export function AppDialogProvider({ children }: { children: ReactNode }) {
  const [confirmState, setConfirmState] = useState<ConfirmPending | null>(null);
  const [alertState, setAlertState] = useState<AlertPending | null>(null);

  const confirmModal = useOverlayState({
    isOpen: confirmState != null,
    onOpenChange: (open) => {
      if (!open) {
        setConfirmState((s) => {
          if (s) s.resolve(false);
          return null;
        });
      }
    },
  });

  const alertModal = useOverlayState({
    isOpen: alertState != null,
    onOpenChange: (open) => {
      if (!open) {
        setAlertState((s) => {
          if (s) s.resolve();
          return null;
        });
      }
    },
  });

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({ ...opts, resolve });
    });
  }, []);

  const showAlert = useCallback((message: string, title?: string) => {
    return new Promise<void>((resolve) => {
      setAlertState({ message, title, resolve });
    });
  }, []);

  const finishConfirm = (v: boolean) => {
    setConfirmState((s) => {
      if (s) s.resolve(v);
      return null;
    });
  };

  const finishAlert = () => {
    setAlertState((s) => {
      if (s) s.resolve();
      return null;
    });
  };

  return (
    <AppDialogContext.Provider value={{ confirm, showAlert }}>
      {children}

      <Modal.Root state={confirmModal}>
        <Modal.Backdrop>
          <Modal.Container placement="center" size="md" scroll="inside">
            <Modal.Dialog className="max-w-md rounded-2xl border border-black/6 p-0 shadow-xl">
              {confirmState ? (
                <>
                  <Modal.Header className="border-b border-black/6 px-5 py-4">
                    <Modal.Heading>{confirmState.title}</Modal.Heading>
                  </Modal.Header>
                  {confirmState.description ? (
                    <Modal.Body className="px-5 py-4">
                      <p className="text-sm text-foreground/70">
                        {confirmState.description}
                      </p>
                    </Modal.Body>
                  ) : null}
                  <Modal.Footer className="flex justify-end gap-2 border-t border-black/6 px-5 py-4">
                    <Button
                      variant="ghost"
                      onPress={() => finishConfirm(false)}
                    >
                      {confirmState.cancelLabel ?? "Hủy"}
                    </Button>
                    <Button
                      className={
                        confirmState.tone === "danger"
                          ? "bg-red-600 font-semibold text-white hover:bg-red-700"
                          : "bg-[#1a3c34] font-semibold text-white"
                      }
                      onPress={() => finishConfirm(true)}
                    >
                      {confirmState.confirmLabel ?? "Xác nhận"}
                    </Button>
                  </Modal.Footer>
                </>
              ) : null}
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal.Root>

      <Modal.Root state={alertModal}>
        <Modal.Backdrop>
          <Modal.Container placement="center" size="md" scroll="inside">
            <Modal.Dialog className="max-w-md rounded-2xl border border-black/6 p-0 shadow-xl">
              {alertState ? (
                <>
                  <Modal.Header className="border-b border-black/6 px-5 py-4">
                    <Modal.Heading>{alertState.title ?? "Thông báo"}</Modal.Heading>
                  </Modal.Header>
                  <Modal.Body className="px-5 py-4">
                    <p className="whitespace-pre-wrap text-sm text-foreground/80">
                      {alertState.message}
                    </p>
                  </Modal.Body>
                  <Modal.Footer className="flex justify-end border-t border-black/6 px-5 py-4">
                    <Button
                      className="bg-[#1a3c34] font-semibold text-white"
                      onPress={finishAlert}
                    >
                      Đóng
                    </Button>
                  </Modal.Footer>
                </>
              ) : null}
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal.Root>
    </AppDialogContext.Provider>
  );
}
