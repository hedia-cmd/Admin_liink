import * as React from "react";
import { BooleanInput, NumberInput } from "react-admin";
import { useFormContext, useWatch } from "react-hook-form";

type CityExplorationValues = {
  is_active?: boolean;
  is_exploration_active?: boolean;
  center_lat?: number | null;
  center_lng?: number | null;
};

const isEmpty = (value: unknown) =>
  value === null || value === undefined || value === "";

export const validateExplorationAvailability = (
  value: unknown,
  values: CityExplorationValues,
) =>
  value === true && values?.is_active !== true
    ? "La ville doit être active avant d’être disponible dans l’exploration principale."
    : undefined;

export const validateCenterLatitude = (
  value: unknown,
  values: CityExplorationValues,
) => {
  if (isEmpty(value)) {
    return values?.is_exploration_active || !isEmpty(values?.center_lng)
      ? "La latitude du centre est obligatoire avec la longitude ou lorsque l’exploration est activée."
      : undefined;
  }
  const latitude = Number(value);
  return Number.isFinite(latitude) && latitude >= -90 && latitude <= 90
    ? undefined
    : "La latitude doit être comprise entre -90 et 90."
};

export const validateCenterLongitude = (
  value: unknown,
  values: CityExplorationValues,
) => {
  if (isEmpty(value)) {
    return values?.is_exploration_active || !isEmpty(values?.center_lat)
      ? "La longitude du centre est obligatoire avec la latitude ou lorsque l’exploration est activée."
      : undefined;
  }
  const longitude = Number(value);
  return Number.isFinite(longitude) && longitude >= -180 && longitude <= 180
    ? undefined
    : "La longitude doit être comprise entre -180 et 180."
};

export const CityExplorationInputs = () => {
  const isActive = useWatch({ name: "is_active" });
  const isExplorationActive = useWatch({ name: "is_exploration_active" });
  const { setValue } = useFormContext();

  React.useEffect(() => {
    if (isActive === false && isExplorationActive === true) {
      setValue("is_exploration_active", false, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
    }
  }, [isActive, isExplorationActive, setValue]);

  return (
    <>
      <BooleanInput
        source="is_exploration_active"
        label="Disponible dans l’exploration principale"
        defaultValue={false}
        disabled={isActive !== true}
        validate={validateExplorationAvailability}
        helperText={
          isActive === true
            ? "Affiche cette ville dans le nouveau tunnel Huekif."
            : "Activez d’abord la ville pour autoriser son exploration."
        }
      />
      <NumberInput
        source="center_lat"
        label="Latitude du centre"
        validate={validateCenterLatitude}
        required={isExplorationActive === true}
        helperText="Valeur comprise entre -90 et 90."
      />
      <NumberInput
        source="center_lng"
        label="Longitude du centre"
        validate={validateCenterLongitude}
        required={isExplorationActive === true}
        helperText="Valeur comprise entre -180 et 180."
      />
    </>
  );
};
