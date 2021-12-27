import * as Dialog from "@radix-ui/react-dialog";
import { keyframes, styled } from "@stitches/react";
import { PropsWithChildren } from "react";

export const Root = Dialog.Root;
export const Trigger = Dialog.Trigger;

export const Title = styled(Dialog.Title, {
  fontWeight: 600,
  fontSize: "$xl",
});
export const Description = styled(Dialog.Description, {
  display: "none",
});
export const Close = styled(Dialog.Close, {});

const overlayShow = keyframes({
  from: { opacity: 0 },
  to: { opacity: 1 },
});

const Overlay = styled(Dialog.Overlay, {
  inset: 0,
  position: "fixed",
  backgroundColor: "rgba(0,0,0,0.5)",
  "@media (prefers-reduced-motion: no-preference)": {
    animation: `${overlayShow} 150ms cubic-bezier(0.16, 1, 0.3, 1)`,
  },
});

const contentShow = keyframes({
  "0%": { opacity: 0, transform: "translate3d(60%, 0, 0)" },
  "100%": { opacity: 1, transform: "translate3d(0, 0, 0)" },
});

const ContentRoot = styled(Dialog.Content, {
  padding: "$xl",
  color: "$hiContrast",
  position: "fixed",
  background: "$loContrast",
  right: 0,
  top: 0,
  bottom: 0,
  width: 400,

  "@media (prefers-reduced-motion: no-preference)": {
    animation: `${contentShow} 250ms ease`,
  },
});

export const Content = (props: PropsWithChildren<{}>) => {
  return (
    <Dialog.Portal container={document.querySelector<HTMLElement>("#main")}>
      <Overlay />
      <ContentRoot>{props.children}</ContentRoot>
    </Dialog.Portal>
  );
};
