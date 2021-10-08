import * as path from "path";
import * as fs from "fs-extra";
import {
  expect as expectCdk,
  haveResource,
  objectLike,
  stringLike,
  anything,
} from "@aws-cdk/assert";
import { App, Api, Stack, ReactStaticSite } from "../src";

/////////////////////////////
// Test Constructor
/////////////////////////////

test("constructor: environment invalid name", async () => {
  const stack = new Stack(new App(), "stack");
  expect(() => {
    new ReactStaticSite(stack, "Site", {
      path: "test/site",
      environment: {
        API_URL: "my-url",
      },
    });
  }).toThrow(
    /Environment variables in the "Site" ReactStaticSite must start with "REACT_APP_"./
  );
});

test("constructor: default indexPage", async () => {
  const stack = new Stack(new App(), "stack");
  new ReactStaticSite(stack, "Site", {
    path: "test/site",
  });
  expectCdk(stack).to(
    haveResource("AWS::CloudFront::Distribution", {
      DistributionConfig: objectLike({
        DefaultRootObject: "index.html",
      }),
    })
  );
});

test("constructor: default errorPage redirect to indexPage", async () => {
  const stack = new Stack(new App(), "stack");
  new ReactStaticSite(stack, "Site", {
    path: "test/site",
  });
  expectCdk(stack).to(
    haveResource("AWS::CloudFront::Distribution", {
      DistributionConfig: objectLike({
        CustomErrorResponses: [
          {
            ErrorCode: 403,
            ResponseCode: 200,
            ResponsePagePath: "/index.html",
          },
          {
            ErrorCode: 404,
            ResponseCode: 200,
            ResponsePagePath: "/index.html",
          },
        ],
      }),
    })
  );
});

test("constructor: default buildCommand", async () => {
  const stack = new Stack(new App(), "stack");
  const api = new Api(stack, "Api");
  new ReactStaticSite(stack, "Site", {
    path: "test/site",
    environment: {
      REACT_APP_CONSTANT_ENV: "my-url",
      REACT_APP_REFERENCE_ENV: api.url,
    },
  });
  const indexHtml = fs.readFileSync(
    path.join(__dirname, "site", "build", "index.html")
  );
  expect(indexHtml.toString().trim()).toBe(
    "my-url {{ REACT_APP_REFERENCE_ENV }}"
  );
});

test("constructor: default buildCommand override", async () => {
  const stack = new Stack(new App(), "stack");
  const api = new Api(stack, "Api");
  new ReactStaticSite(stack, "Site", {
    path: "test/site",
    buildCommand:
      'rm -rf build && mkdir build && node -e "console.log(process.env.REACT_APP_CONSTANT_ENV, process.env.REACT_APP_REFERENCE_ENV, process.env.REACT_APP_REFERENCE_ENV)" > build/index.html',
    environment: {
      REACT_APP_CONSTANT_ENV: "my-url",
      REACT_APP_REFERENCE_ENV: api.url,
    },
  });
  const indexHtml = fs.readFileSync(
    path.join(__dirname, "site", "build", "index.html")
  );
  expect(indexHtml.toString().trim()).toBe(
    "my-url {{ REACT_APP_REFERENCE_ENV }} {{ REACT_APP_REFERENCE_ENV }}"
  );
});

test("constructor: default fileOptions for cache control", async () => {
  const stack = new Stack(new App(), "stack");
  new ReactStaticSite(stack, "Site", {
    path: "test/site",
  });
  expectCdk(stack).to(
    haveResource("Custom::SSTBucketDeployment", {
      Sources: [
        {
          BucketName: anything(),
          ObjectKey: anything(),
        },
      ],
      DistributionPaths: ["/*"],
      DestinationBucketName: {
        Ref: "SiteBucket978D4AEB",
      },
      DestinationBucketKeyPrefix: stringLike("deploy-*"),
      FileOptions: [
        [
          "--exclude",
          "*",
          "--include",
          "*.html",
          "--cache-control",
          "max-age=0,no-cache,no-store,must-revalidate",
        ],
        [
          "--exclude",
          "*",
          "--include",
          "*.js",
          "--include",
          "*.css",
          "--cache-control",
          "max-age=31536000,public,immutable",
        ],
      ],
      ReplaceValues: [],
    })
  );
});

test("constructor: default replaceValues", async () => {
  const stack = new Stack(new App(), "stack");
  const api = new Api(stack, "Api");

  new ReactStaticSite(stack, "Site", {
    path: "test/site",
    environment: {
      REACT_APP_CONSTANT_ENV: "my-url",
      REACT_APP_REFERENCE_ENV: api.url,
    },
  });
  expectCdk(stack).to(
    haveResource("Custom::SSTBucketDeployment", {
      ReplaceValues: [
        {
          files: "**/*.js",
          search: "{{ REACT_APP_REFERENCE_ENV }}",
          replace: { "Fn::GetAtt": anything() },
        },
        {
          files: "index.html",
          search: "{{ REACT_APP_REFERENCE_ENV }}",
          replace: { "Fn::GetAtt": anything() },
        },
      ],
    })
  );
});

test("constructor: default replaceValues override", async () => {
  const stack = new Stack(new App(), "stack");
  const api = new Api(stack, "Api");
  new ReactStaticSite(stack, "Site", {
    path: "test/site",
    environment: {
      REACT_APP_CONSTANT_ENV: "my-url",
      REACT_APP_REFERENCE_ENV: api.url,
    },
    replaceValues: [
      {
        files: "*.txt",
        search: "{{ KEY }}",
        replace: "value",
      },
    ],
  });
  expectCdk(stack).to(
    haveResource("Custom::SSTBucketDeployment", {
      ReplaceValues: [
        {
          files: "*.txt",
          search: "{{ KEY }}",
          replace: "value",
        },
        {
          files: "**/*.js",
          search: "{{ REACT_APP_REFERENCE_ENV }}",
          replace: { "Fn::GetAtt": anything() },
        },
        {
          files: "index.html",
          search: "{{ REACT_APP_REFERENCE_ENV }}",
          replace: { "Fn::GetAtt": anything() },
        },
      ],
    })
  );
});
