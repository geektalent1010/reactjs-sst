import { styled } from "@stitches/react";
import {
  forwardRef,
  ReactNode,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

const Root = styled("div", {
  position: "relative",
  fontSize: "$sm",
});

const InputRaw = styled("input", {
  height: 36,
  width: "100%",
  color: "$hiContrast",
  background: "$loContrast",
  border: "1px solid $border",
  padding: "0 $sm",
  borderRadius: 4,
  fontFamily: "$sans",
  outline: 0,
  "&:focus": {
    border: "1px solid $highlight",
  },
});

type InputProps = {
  prefix?: any;
  suffix?: any;
};

const InputAddon = styled("div", {
  position: "absolute",
  left: 0,
  height: 36,
  padding: "0 $sm",
  display: "flex",
  alignItems: "center",
});

export const Input = forwardRef<
  React.ElementRef<typeof InputRaw>,
  React.ComponentProps<typeof InputRaw> & InputProps
>((props, forwardedRef) => {
  const prefix = useRef<HTMLDivElement>(null);
  const [prefixWidth, prefixWidthSet] = useState(0);

  useLayoutEffect(() => {
    if (!prefix.current) return;
    prefixWidthSet(prefix.current.getBoundingClientRect().width);
  }, [props.children, prefix.current]);

  return (
    <Root>
      {props.prefix && <InputAddon ref={prefix}>{props.prefix}</InputAddon>}
      <InputRaw
        {...props}
        ref={forwardedRef}
        style={{
          paddingLeft: prefixWidth ? prefixWidth : "inherit",
        }}
      />
      {props.suffix}
    </Root>
  );
});
