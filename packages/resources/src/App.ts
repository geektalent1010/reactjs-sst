import * as cdk from "@aws-cdk/core";

/**
 * Deploy props for apps.
 */
export interface DeployProps {
  /**
   * The app name, used to prefix stacks.
   *
   * @default - Defaults to empty string
   */
  readonly name?: string;

  /**
   * The stage to deploy this app to.
   *
   * @default - Defaults to dev
   */
  readonly stage?: string;

  /**
   * The region to deploy this app to.
   *
   * @default - Defaults to us-east-1
   */
  readonly region?: string;
}

export class App extends cdk.App {
  /**
   * The app name
   */
  public readonly name: string;

  /**
   * The stage to deploy to
   */
  public readonly stage: string;

  /**
   * The region to deploy to
   */
  public readonly region: string;

  constructor(deployProps: DeployProps = {}, props: cdk.AppProps = {}) {
    super(props);

    this.name = deployProps.name || "";
    this.stage = deployProps.stage || "dev";
    this.region = deployProps.region || "us-east-1";
  }

  logicalPrefixedName(logicalName: string): string {
    const namePrefix = this.name === "" ? "" : `${this.name}-`;
    return `${this.stage}-${namePrefix}${logicalName}`;
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  synth(options: cdk.StageSynthesisOptions = {}) {
    for (const child of this.node.children) {
      if (
        child instanceof cdk.Stack &&
        child.stackName.indexOf(`${this.stage}-`) !== 0
      ) {
        throw `Stack ${child.stackName} is not prefixed with the stage`;
      }
    }
    return super.synth(options);
  }
}
