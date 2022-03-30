import * as apig from "@aws-cdk/aws-apigatewayv2-alpha";
import { z } from "zod";
import { Duration, toCdkDuration } from "./duration";

export const CorsPropsSchema = z.object({
  allowCredentials: z.boolean().optional(),
  allowHeaders: z.string().array().optional(),
  allowMethods: z.string().array().optional(),
  allowOrigins: z.string().array().optional(),
  exposeHeaders: z.string().array().optional(),
  maxAge: z.string().optional(),
});
export interface CorsProps {
  allowCredentials?: boolean;
  allowHeaders?: string[];
  allowMethods?: (keyof typeof apig.CorsHttpMethod)[];
  allowOrigins?: string[];
  exposeHeaders?: string[];
  maxAge?: Duration;
}

export function buildCorsConfig(
  cors?: boolean | CorsProps
): apig.CorsPreflightOptions | undefined {
  // Handle cors: false
  if (cors === false) {
    return;
  }

  // Handle cors: true | undefined
  else if (cors === undefined || cors === true) {
    return {
      allowHeaders: ["*"],
      allowMethods: [apig.CorsHttpMethod.ANY],
      allowOrigins: ["*"],
    };
  }

  // Handle cors: apig.CorsPreflightOptions
  else {
    return {
      allowCredentials: cors.allowCredentials,
      allowHeaders: cors.allowHeaders,
      allowMethods: cors.allowMethods as apig.CorsHttpMethod[],
      allowOrigins: cors.allowOrigins,
      exposeHeaders: cors.exposeHeaders,
      maxAge: cors.maxAge && toCdkDuration(cors.maxAge),
    };
    cors as apig.CorsPreflightOptions;
  }
}
