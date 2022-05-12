import { OperationContext, RequestPolicy, useQuery, useMutation } from "urql";
import { ValueTypes } from "@@@app/graphql/zeus";
import { ZeusTD } from "@@@app/graphql/zeus/typedDocumentNode";

interface TypedQueryOpts<O extends "Query", TData extends ValueTypes[O]> {
  query: TData | ValueTypes[O];
  requestPolicy?: RequestPolicy;
  context?: Partial<OperationContext>;
  pause?: boolean;
}

export function useTypedQuery<O extends "Query", TData extends ValueTypes[O]>(
  opts: TypedQueryOpts<O, TData>
) {
  return useQuery<TData>({
    ...opts,
    query: ZeusTD("query", opts.query),
  });
}

export function useTypedMutation<
  O extends "Mutation",
  TData extends ValueTypes[O]
>(query: TData | ValueTypes[O]) {
  return useMutation<TData>(ZeusTD("mutation", query));
}
