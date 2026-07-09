import { Create, SimpleForm, TextInput, BooleanInput, NumberInput, ReferenceInput, SelectInput } from "react-admin";
import Typography from "@mui/material/Typography";

export const CategoriesCreate = () => (
  <Create>
    <SimpleForm>
      <TextInput source="label" fullWidth />
      <TextInput source="slug" fullWidth />
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Si aucune région ni ville n’est choisie, la catégorie sera visible partout.
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Si une ville est choisie, elle prime sur la région.
      </Typography>
      <ReferenceInput source="region_id" reference="regions" label="Région">
        <SelectInput
          optionText="name"
          optionValue="id"
          emptyText="Toutes les régions"
          emptyValue=""
          parse={(value: string) => (value === "" ? null : value)}
          fullWidth
        />
      </ReferenceInput>
      <ReferenceInput source="city_id" reference="cities" label="Ville">
        <SelectInput
          optionText="name"
          optionValue="id"
          emptyText="Toutes les villes"
          emptyValue=""
          parse={(value: string) => (value === "" ? null : value)}
          fullWidth
        />
      </ReferenceInput>
      <TextInput source="description" multiline fullWidth />
      <NumberInput source="sort_order" defaultValue={0} />
      <BooleanInput source="is_active" defaultValue />
    </SimpleForm>
  </Create>
);
