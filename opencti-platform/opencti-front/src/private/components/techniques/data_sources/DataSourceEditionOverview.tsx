import React, { FunctionComponent } from 'react';
import { graphql, useFragment } from 'react-relay';
import { Field, Form, Formik } from 'formik';
import * as Yup from 'yup';
import { FormikConfig } from 'formik/dist/types';
import { useFormatter } from '../../../../components/i18n';
import TextField from '../../../../components/TextField';
import { SubscriptionFocus } from '../../../../components/Subscription';
import CreatedByField from '../../common/form/CreatedByField';
import ObjectMarkingField from '../../common/form/ObjectMarkingField';
import MarkDownField from '../../../../components/MarkDownField';
import { convertCreatedBy, convertMarkings, convertStatus } from '../../../../utils/edition';
import StatusField from '../../common/form/StatusField';
import { Option } from '../../common/form/ReferenceField';
import CommitMessage from '../../common/form/CommitMessage';
import { adaptFieldValue } from '../../../../utils/String';
import { DataSourceEditionOverview_dataSource$key } from './__generated__/DataSourceEditionOverview_dataSource.graphql';
import ConfidenceField from '../../common/form/ConfidenceField';
import { fieldSpacingContainerStyle } from '../../../../utils/field';
import OpenVocabField from '../../common/form/OpenVocabField';
import { useYupSchemaBuilder } from '../../../../utils/hooks/useEntitySettings';
import useFormEditor from '../../../../utils/hooks/useFormEditor';
import { dataComponentEditionOverviewFocus } from '../data_components/DataComponentEditionOverview';

const dataSourceMutationFieldPatch = graphql`
  mutation DataSourceEditionOverviewFieldPatchMutation(
    $id: ID!
    $input: [EditInput]!
    $commitMessage: String
    $references: [String]
  ) {
    dataSourceFieldPatch(
      id: $id
      input: $input
      commitMessage: $commitMessage
      references: $references
    ) {
        ...DataSourceEditionOverview_dataSource
        ...DataSource_dataSource
      }
    }
`;

export const dataSourceEditionOverviewFocus = graphql`
  mutation DataSourceEditionOverviewFocusMutation($id: ID!, $input: EditContext!) {
    dataSourceContextPatch(id: $id, input: $input) {
      id
    }
  }
`;

const dataSourceMutationRelationAdd = graphql`
  mutation DataSourceEditionOverviewRelationAddMutation(
    $id: ID!
    $input: StixMetaRelationshipAddInput!
  ) {
    dataSourceRelationAdd(id: $id, input: $input) {
      from {
        ...DataSourceEditionOverview_dataSource
      }
    }
  }
`;

const dataSourceMutationRelationDelete = graphql`
  mutation DataSourceEditionOverviewRelationDeleteMutation(
    $id: ID!
    $toId: StixRef!
    $relationship_type: String!
  ) {
    dataSourceRelationDelete(
      id: $id, 
      toId: $toId, 
      relationship_type: $relationship_type
    ) {
        ...DataSourceEditionOverview_dataSource
      }
    }
`;

const dataSourceEditionOverviewFragment = graphql`
  fragment DataSourceEditionOverview_dataSource on DataSource {
    id
    name
    description
    confidence
    x_opencti_stix_ids
    x_mitre_platforms
    collection_layers
    createdBy {
      ... on Identity {
        id
        name
        entity_type
      }
    }
    objectMarking {
      edges {
        node {
          id
          definition_type
          definition
          x_opencti_order
          x_opencti_color
        }
      }
    }
    status {
      id
      order
      template {
        name
        color
      }
    }
    workflowEnabled
  }
`;

interface DataSourceEditionOverviewProps {
  data: DataSourceEditionOverview_dataSource$key,
  context: readonly ({
    readonly focusOn: string | null;
    readonly name: string;
  } | null)[] | null
  enableReferences?: boolean
  handleClose: () => void
}

interface DataSourceEditionFormValues {
  name: string,
  description: string | null,
  x_opencti_workflow_id: Option,
  createdBy: Option | undefined,
  confidence: number | null,
  x_mitre_platforms: string[] | null,
  collection_layers: string[],
  objectMarking: Option[],
  message?: string,
  references?: Option[],
}

const DataSourceEditionOverview: FunctionComponent<DataSourceEditionOverviewProps> = ({
  data,
  context,
  enableReferences = false,
  handleClose,
}) => {
  const { t } = useFormatter();
  const dataSource = useFragment(dataSourceEditionOverviewFragment, data);

  const basicShape = {
    name: Yup.string().required(t('This field is required')),
    description: Yup.string().nullable(),
    x_opencti_workflow_id: Yup.object(),
    confidence: Yup.number(),
    x_mitre_platforms: Yup.array(),
    collection_layers: Yup.array(),
    references: Yup.array(),
  };
  const dataSourceValidator = useYupSchemaBuilder('Data-Source', basicShape);

  const queries = {
    fieldPatch: dataSourceMutationFieldPatch,
    relationAdd: dataSourceMutationRelationAdd,
    relationDelete: dataSourceMutationRelationDelete,
    editionFocus: dataComponentEditionOverviewFocus,
  };
  const editor = useFormEditor(dataSource, enableReferences, queries, dataSourceValidator);

  const onSubmit: FormikConfig<DataSourceEditionFormValues>['onSubmit'] = (values, { setSubmitting }) => {
    const { message, references, ...otherValues } = values;
    const commitMessage = message ?? '';
    const commitReferences = (references ?? []).map(({ value }) => value);

    const inputValues = Object.entries({
      ...otherValues,
      createdBy: values.createdBy?.value,
      objectMarking: (values.objectMarking ?? []).map(({ value }) => value),
      x_opencti_workflow_id: values.x_opencti_workflow_id?.value,
    }).map(([key, value]) => ({ key, value: adaptFieldValue(value) }));

    editor.fieldPatch({
      variables: {
        id: dataSource.id,
        input: inputValues,
        commitMessage: commitMessage && commitMessage.length > 0 ? commitMessage : null,
        references: commitReferences,
      },
      onCompleted: () => {
        setSubmitting(false);
        handleClose();
      },
    });
  };

  const handleSubmitField = (name: string, value: Option | string | string[]) => {
    if (!enableReferences) {
      let finalValue: unknown = value as string;
      if (name === 'x_opencti_workflow_id') {
        finalValue = (value as Option).value;
      }
      dataSourceValidator
        .validateAt(name, { [name]: value })
        .then(() => {
          editor.fieldPatch({
            variables: {
              id: dataSource.id,
              input: { key: name, value: finalValue || '' },
            },
          });
        })
        .catch(() => false);
    }
  };

  const initialValues = {
    name: dataSource.name,
    description: dataSource.description,
    createdBy: convertCreatedBy(dataSource),
    objectMarking: convertMarkings(dataSource),
    x_opencti_workflow_id: convertStatus(t, dataSource) as Option,
    confidence: dataSource.confidence,
    x_mitre_platforms: dataSource.x_mitre_platforms,
    collection_layers: dataSource.collection_layers,
    references: [],
  };

  return (
    <Formik enableReinitialize={true}
      initialValues={initialValues as never}
      validationSchema={dataSourceValidator}
      onSubmit={onSubmit}>
      {({
        submitForm,
        isSubmitting,
        setFieldValue,
        values,
        isValid,
        dirty,
      }) => (
        <Form style={{ margin: '20px 0 20px 0' }}>
          <Field
            component={TextField}
            variant="standard"
            name="name"
            label={t('Name')}
            fullWidth={true}
            onFocus={editor.changeFocus}
            onSubmit={handleSubmitField}
            helperText={
              <SubscriptionFocus context={context} fieldName="name" />
            }
          />
          <ConfidenceField
            name="confidence"
            onFocus={editor.changeFocus}
            onChange={handleSubmitField}
            label={t('Confidence')}
            fullWidth={true}
            containerStyle={fieldSpacingContainerStyle}
            editContext={context}
            variant="edit"
          />
          <Field
            component={MarkDownField}
            name="description"
            label={t('Description')}
            fullWidth={true}
            multiline={true}
            rows="4"
            style={{ marginTop: 20 }}
            onFocus={editor.changeFocus}
            onSubmit={handleSubmitField}
            helperText={
              <SubscriptionFocus context={context} fieldName="description" />
            }
          />
          {dataSource?.workflowEnabled && (
            <StatusField
              name="x_opencti_workflow_id"
              type="Data-Source"
              onFocus={editor.changeFocus}
              onChange={handleSubmitField}
              setFieldValue={setFieldValue}
              style={{ marginTop: 20 }}
              helpertext={
                <SubscriptionFocus
                  context={context}
                  fieldName="x_opencti_workflow_id"
                />
              }
            />
          )}
          <CreatedByField
            name="createdBy"
            style={{ marginTop: 20, width: '100%' }}
            setFieldValue={setFieldValue}
            helpertext={
              <SubscriptionFocus context={context} fieldName="createdBy" />
            }
            onChange={editor.changeCreated}
          />
          <ObjectMarkingField
            name="objectMarking"
            style={{ marginTop: 20, width: '100%' }}
            helpertext={
              <SubscriptionFocus context={context} fieldname="objectMarking" />
            }
            onChange={editor.changeMarking}
          />
          <OpenVocabField
            label={t('Platforms')}
            type="platforms_ov"
            name="x_mitre_platforms"
            variant={'edit'}
            onSubmit={handleSubmitField}
            onChange={(name, value) => setFieldValue(name, value)}
            containerStyle={fieldSpacingContainerStyle}
            multiple={true}
            editContext={context}
          />
          <OpenVocabField
            label={t('Layers')}
            type="collection_layers_ov"
            name="collection_layers"
            variant={'edit'}
            onSubmit={handleSubmitField}
            onChange={(name, value) => setFieldValue(name, value)}
            containerStyle={fieldSpacingContainerStyle}
            multiple={true}
            editContext={context}
          />
          {enableReferences && (
            <CommitMessage
              submitForm={submitForm}
              disabled={isSubmitting || !isValid || !dirty}
              setFieldValue={setFieldValue}
              open={false}
              values={values.references}
              id={dataSource.id}
            />
          )}
        </Form>
      )}
    </Formik>
  );
};

export default DataSourceEditionOverview;
