export function buildResultRowActions(item_name, recipe_id, update_recipe_choice, update_recipe_setting) {
    return {
        change_recipe: (value) => update_recipe_choice(item_name, value),
        change_pro_num: (value) => update_recipe_setting(recipe_id, "增产点数", Number(value)),
        change_pro_mode: (value) => update_recipe_setting(recipe_id, "增产模式", Number(value)),
        change_factory: (value) => update_recipe_setting(recipe_id, "建筑", value),
    };
}
