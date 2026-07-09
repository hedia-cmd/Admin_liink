import { List, Datagrid, TextField, BooleanField, NumberField, ReferenceField } from "react-admin";

export const CategoriesList = () => (
  <List>
    <Datagrid rowClick="edit">
      <TextField source="label" label="Libellé" />
      <ReferenceField source="region_id" reference="regions" label="Région" link={false}>
        <TextField source="name" />
      </ReferenceField>
      <ReferenceField source="city_id" reference="cities" label="Ville" link={false}>
        <TextField source="name" />
      </ReferenceField>
      <BooleanField source="is_active" label="Actif" />
      <NumberField source="sort_order" label="Ordre" />
    </Datagrid>
  </List>
);
