import { Create, SimpleForm, TextInput, BooleanInput, NumberInput } from "react-admin";

export const CategoriesCreate = () => (
  <Create>
    <SimpleForm>
      <TextInput source="label" fullWidth />
      <TextInput source="slug" fullWidth />
      <TextInput source="description" multiline fullWidth />
      <NumberInput source="sort_order" defaultValue={0} />
      <BooleanInput source="is_active" defaultValue />
    </SimpleForm>
  </Create>
);
