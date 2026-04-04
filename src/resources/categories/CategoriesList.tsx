import { List, Datagrid, TextField, BooleanField, NumberField } from "react-admin";

export const CategoriesList = () => (
  <List>
    <Datagrid rowClick="edit">
      <TextField source="label" />
      <TextField source="slug" />
      <NumberField source="sort_order" />
      <BooleanField source="is_active" />
    </Datagrid>
  </List>
);
